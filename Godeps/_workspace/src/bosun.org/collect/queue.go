package collect

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"time"

	"bosun.org/opentsdb"
	"bosun.org/slog"
)

func queuer() {
	for dp := range tchan {
		qlock.Lock()
		for {
			if len(queue) > MaxQueueLen {
				slock.Lock()
				dropped++
				slock.Unlock()
				break
			}
			m, err := json.Marshal(dp)
			if err != nil {
				slog.Error(err)
			} else {
				queue = append(queue, m)
			}
			select {
			case dp = <-tchan:
				continue
			default:
			}
			break
		}
		qlock.Unlock()
	}
}

func send() {
	for {
		qlock.Lock()
		if i := len(queue); i > 0 {
			if i > BatchSize {
				i = BatchSize
			}
			sending := queue[:i]
			queue = queue[i:]
			if Debug {
				slog.Infof("sending: %d, remaining: %d", i, len(queue))
			}
			qlock.Unlock()
			sendBatch(sending)
		} else {
			qlock.Unlock()
			time.Sleep(time.Second)
		}
	}
}

func sendBatch(batch []json.RawMessage) {
	if Print {
		for _, d := range batch {
			slog.Info(string(d))
		}
		recordSent(len(batch))
		return
	}
	var buf bytes.Buffer
	g := gzip.NewWriter(&buf)
	if err := json.NewEncoder(g).Encode(batch); err != nil {
		slog.Error(err)
		return
	}
	if err := g.Close(); err != nil {
		slog.Error(err)
		return
	}
	req, err := http.NewRequest("POST", tsdbURL, &buf)
	if err != nil {
		slog.Error(err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	now := time.Now()
	resp, err := client.Do(req)
	d := time.Since(now).Nanoseconds() / 1e6
	if err == nil {
		defer resp.Body.Close()
	}
	Add("collect.post.total_duration", Tags, d)
	Add("collect.post.count", Tags, 1)
	// Some problem with connecting to the server; retry later.
	if err != nil || resp.StatusCode != http.StatusNoContent {
		if err != nil {
			Add("collect.post.error", Tags, 1)
			slog.Error(err)
		} else if resp.StatusCode != http.StatusNoContent {
			Add("collect.post.bad_status", Tags, 1)
			slog.Errorln(resp.Status)
			body, err := ioutil.ReadAll(resp.Body)
			if err != nil {
				slog.Error(err)
			}
			if len(body) > 0 {
				slog.Error(string(body))
			}
		}
		restored := 0
		for _, msg := range batch {
			var dp opentsdb.DataPoint
			if err := json.Unmarshal(msg, &dp); err != nil {
				slog.Error(err)
				continue
			}
			restored++
			tchan <- &dp
		}
		d := time.Second * 5
		Add("collect.post.restore", Tags, int64(restored))
		slog.Infof("restored %d, sleeping %s", restored, d)
		time.Sleep(d)
		return
	}
	recordSent(len(batch))
}

func recordSent(num int) {
	if Debug {
		slog.Infoln("sent", num)
	}
	slock.Lock()
	sent += int64(num)
	slock.Unlock()
}
