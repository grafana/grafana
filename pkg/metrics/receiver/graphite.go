package receiver

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"net"
	"time"
)

type GraphiteSender struct {
	Host     string
	Port     string
	Protocol string
	Prefix   string
}

func (this *GraphiteSender) Send(metrics map[string]interface{}) error {
	log.Debug("GraphiteSender: Sending metrics to graphite")

	address := fmt.Sprintf("%s:%s", this.Host, this.Port)
	conn, err := net.DialTimeout(this.Protocol, address, time.Second*5)

	if err != nil {
		return fmt.Errorf("Graphite Sender: Failed to connec to %s!", err)
	}

	buf := bytes.NewBufferString("")
	now := time.Now().Unix()
	for key, value := range metrics {
		metricName := this.Prefix + key
		line := fmt.Sprintf("%s %d %d\n", metricName, value, now)
		log.Debug("SendMetric: sending %s", line)
		buf.WriteString(line)
	}

	_, err = conn.Write(buf.Bytes())

	if err != nil {
		return fmt.Errorf("Graphite Sender: Failed to send metrics!", err)
	}

	return nil
}
