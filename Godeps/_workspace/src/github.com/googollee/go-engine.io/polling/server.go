package polling

import (
	"bytes"
	"html/template"
	"io"
	"net/http"
	"sync"

	"github.com/googollee/go-engine.io/message"
	"github.com/googollee/go-engine.io/parser"
	"github.com/googollee/go-engine.io/transport"
)

type state int

const (
	stateUnknow state = iota
	stateNormal
	stateClosing
	stateClosed
)

type Polling struct {
	sendChan    chan bool
	encoder     *parser.PayloadEncoder
	callback    transport.Callback
	getLocker   *Locker
	postLocker  *Locker
	state       state
	stateLocker sync.Mutex
}

func NewServer(w http.ResponseWriter, r *http.Request, callback transport.Callback) (transport.Server, error) {
	newEncoder := parser.NewBinaryPayloadEncoder
	if r.URL.Query()["b64"] != nil {
		newEncoder = parser.NewStringPayloadEncoder
	}
	ret := &Polling{
		sendChan:   MakeSendChan(),
		encoder:    newEncoder(),
		callback:   callback,
		getLocker:  NewLocker(),
		postLocker: NewLocker(),
		state:      stateNormal,
	}
	return ret, nil
}

func (p *Polling) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		p.get(w, r)
	case "POST":
		p.post(w, r)
	}
}

func (p *Polling) Close() error {
	if p.getState() != stateNormal {
		return nil
	}
	close(p.sendChan)
	p.setState(stateClosing)
	if p.getLocker.TryLock() {
		if p.postLocker.TryLock() {
			p.callback.OnClose(p)
			p.setState(stateClosed)
			p.postLocker.Unlock()
		}
		p.getLocker.Unlock()
	}
	return nil
}

func (p *Polling) NextWriter(msgType message.MessageType, packetType parser.PacketType) (io.WriteCloser, error) {
	if p.getState() != stateNormal {
		return nil, io.EOF
	}

	var ret io.WriteCloser
	var err error
	switch msgType {
	case message.MessageText:
		ret, err = p.encoder.NextString(packetType)
	case message.MessageBinary:
		ret, err = p.encoder.NextBinary(packetType)
	}

	if err != nil {
		return nil, err
	}
	return NewWriter(ret, p), nil
}

func (p *Polling) get(w http.ResponseWriter, r *http.Request) {
	if !p.getLocker.TryLock() {
		http.Error(w, "overlay get", http.StatusBadRequest)
		return
	}
	if p.getState() != stateNormal {
		http.Error(w, "closed", http.StatusBadRequest)
		return
	}

	defer func() {
		if p.getState() == stateClosing {
			if p.postLocker.TryLock() {
				p.setState(stateClosed)
				p.callback.OnClose(p)
				p.postLocker.Unlock()
			}
		}
		p.getLocker.Unlock()
	}()

	<-p.sendChan

	if j := r.URL.Query().Get("j"); j != "" {
		// JSONP Polling
		w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
		tmp := bytes.Buffer{}
		p.encoder.EncodeTo(&tmp)
		pl := template.JSEscapeString(tmp.String())
		w.Write([]byte("___eio[" + j + "](\""))
		w.Write([]byte(pl))
		w.Write([]byte("\");"))
	} else {
		// XHR Polling
		if p.encoder.IsString() {
			w.Header().Set("Content-Type", "text/plain; charset=UTF-8")
		} else {
			w.Header().Set("Content-Type", "application/octet-stream")
		}
		p.encoder.EncodeTo(w)
	}

}

func (p *Polling) post(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	if !p.postLocker.TryLock() {
		http.Error(w, "overlay post", http.StatusBadRequest)
		return
	}
	if p.getState() != stateNormal {
		http.Error(w, "closed", http.StatusBadRequest)
		return
	}

	defer func() {
		if p.getState() == stateClosing {
			if p.getLocker.TryLock() {
				p.setState(stateClosed)
				p.callback.OnClose(p)
				p.getLocker.Unlock()
			}
		}
		p.postLocker.Unlock()
	}()

	var decoder *parser.PayloadDecoder
	if j := r.URL.Query().Get("j"); j != "" {
		// JSONP Polling
		d := r.FormValue("d")
		decoder = parser.NewPayloadDecoder(bytes.NewBufferString(d))
	} else {
		// XHR Polling
		decoder = parser.NewPayloadDecoder(r.Body)
	}
	for {
		d, err := decoder.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		p.callback.OnPacket(d)
		d.Close()
	}
	w.Write([]byte("ok"))
}

func (p *Polling) setState(s state) {
	p.stateLocker.Lock()
	defer p.stateLocker.Unlock()
	p.state = s
}

func (p *Polling) getState() state {
	p.stateLocker.Lock()
	defer p.stateLocker.Unlock()
	return p.state
}
