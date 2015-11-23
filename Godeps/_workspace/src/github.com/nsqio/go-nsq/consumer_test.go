package nsq

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

type MyTestHandler struct {
	t                *testing.T
	q                *Consumer
	messagesSent     int
	messagesReceived int
	messagesFailed   int
}

var nullLogger = log.New(ioutil.Discard, "", log.LstdFlags)

func (h *MyTestHandler) LogFailedMessage(message *Message) {
	h.messagesFailed++
	h.q.Stop()
}

func (h *MyTestHandler) HandleMessage(message *Message) error {
	if string(message.Body) == "TOBEFAILED" {
		h.messagesReceived++
		return errors.New("fail this message")
	}

	data := struct {
		Msg string
	}{}

	err := json.Unmarshal(message.Body, &data)
	if err != nil {
		return err
	}

	msg := data.Msg
	if msg != "single" && msg != "double" {
		h.t.Error("message 'action' was not correct: ", msg, data)
	}
	h.messagesReceived++
	return nil
}

func SendMessage(t *testing.T, port int, topic string, method string, body []byte) {
	httpclient := &http.Client{}
	endpoint := fmt.Sprintf("http://127.0.0.1:%d/%s?topic=%s", port, method, topic)
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(body))
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatalf(err.Error())
		return
	}
	resp.Body.Close()
}

func TestConsumer(t *testing.T) {
	consumerTest(t, nil)
}

func TestConsumerTLS(t *testing.T) {
	consumerTest(t, func(c *Config) {
		c.TlsV1 = true
		c.TlsConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	})
}

func TestConsumerDeflate(t *testing.T) {
	consumerTest(t, func(c *Config) {
		c.Deflate = true
	})
}

func TestConsumerSnappy(t *testing.T) {
	consumerTest(t, func(c *Config) {
		c.Snappy = true
	})
}

func TestConsumerTLSDeflate(t *testing.T) {
	consumerTest(t, func(c *Config) {
		c.TlsV1 = true
		c.TlsConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
		c.Deflate = true
	})
}

func TestConsumerTLSSnappy(t *testing.T) {
	consumerTest(t, func(c *Config) {
		c.TlsV1 = true
		c.TlsConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
		c.Snappy = true
	})
}

func TestConsumerTLSClientCert(t *testing.T) {
	envDl := os.Getenv("NSQ_DOWNLOAD")
	if strings.HasPrefix(envDl, "nsq-0.2.24") || strings.HasPrefix(envDl, "nsq-0.2.27") {
		t.Log("skipping due to older nsqd")
		return
	}
	cert, _ := tls.LoadX509KeyPair("./test/client.pem", "./test/client.key")
	consumerTest(t, func(c *Config) {
		c.TlsV1 = true
		c.TlsConfig = &tls.Config{
			Certificates:       []tls.Certificate{cert},
			InsecureSkipVerify: true,
		}
	})
}

func TestConsumerTLSClientCertViaSet(t *testing.T) {
	envDl := os.Getenv("NSQ_DOWNLOAD")
	if strings.HasPrefix(envDl, "nsq-0.2.24") || strings.HasPrefix(envDl, "nsq-0.2.27") {
		t.Log("skipping due to older nsqd")
		return
	}
	consumerTest(t, func(c *Config) {
		c.Set("tls_v1", true)
		c.Set("tls_cert", "./test/client.pem")
		c.Set("tls_key", "./test/client.key")
		c.Set("tls_insecure_skip_verify", true)
	})
}

func consumerTest(t *testing.T, cb func(c *Config)) {
	config := NewConfig()
	laddr := "127.0.0.1"
	// so that the test can simulate binding consumer to specified address
	config.LocalAddr, _ = net.ResolveTCPAddr("tcp", laddr+":0")
	// so that the test can simulate reaching max requeues and a call to LogFailedMessage
	config.DefaultRequeueDelay = 0
	// so that the test wont timeout from backing off
	config.MaxBackoffDuration = time.Millisecond * 50
	if cb != nil {
		cb(config)
	}
	topicName := "rdr_test"
	if config.Deflate {
		topicName = topicName + "_deflate"
	} else if config.Snappy {
		topicName = topicName + "_snappy"
	}
	if config.TlsV1 {
		topicName = topicName + "_tls"
	}
	topicName = topicName + strconv.Itoa(int(time.Now().Unix()))
	q, _ := NewConsumer(topicName, "ch", config)
	// q.SetLogger(nullLogger, LogLevelInfo)

	h := &MyTestHandler{
		t: t,
		q: q,
	}
	q.AddHandler(h)

	SendMessage(t, 4151, topicName, "put", []byte(`{"msg":"single"}`))
	SendMessage(t, 4151, topicName, "mput", []byte("{\"msg\":\"double\"}\n{\"msg\":\"double\"}"))
	SendMessage(t, 4151, topicName, "put", []byte("TOBEFAILED"))
	h.messagesSent = 4

	addr := "127.0.0.1:4150"
	err := q.ConnectToNSQD(addr)
	if err != nil {
		t.Fatal(err)
	}

	stats := q.Stats()
	if stats.Connections == 0 {
		t.Fatal("stats report 0 connections (should be > 0)")
	}

	err = q.ConnectToNSQD(addr)
	if err == nil {
		t.Fatal("should not be able to connect to the same NSQ twice")
	}

	conn := q.conns()[0]
	if !strings.HasPrefix(conn.conn.LocalAddr().String(), laddr) {
		t.Fatal("connection should be bound to the specified address:", conn.conn.LocalAddr())
	}

	err = q.DisconnectFromNSQD("1.2.3.4:4150")
	if err == nil {
		t.Fatal("should not be able to disconnect from an unknown nsqd")
	}

	err = q.ConnectToNSQD("1.2.3.4:4150")
	if err == nil {
		t.Fatal("should not be able to connect to non-existent nsqd")
	}

	err = q.DisconnectFromNSQD("1.2.3.4:4150")
	if err != nil {
		t.Fatal("should be able to disconnect from an nsqd - " + err.Error())
	}

	<-q.StopChan

	stats = q.Stats()
	if stats.Connections != 0 {
		t.Fatalf("stats report %d active connections (should be 0)", stats.Connections)
	}

	stats = q.Stats()
	if stats.MessagesReceived != uint64(h.messagesReceived+h.messagesFailed) {
		t.Fatalf("stats report %d messages received (should be %d)",
			stats.MessagesReceived,
			h.messagesReceived+h.messagesFailed)
	}

	if h.messagesReceived != 8 || h.messagesSent != 4 {
		t.Fatalf("end of test. should have handled a diff number of messages (got %d, sent %d)", h.messagesReceived, h.messagesSent)
	}
	if h.messagesFailed != 1 {
		t.Fatal("failed message not done")
	}
}
