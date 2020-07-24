package live

import (
	"encoding/json"
	"math/rand"
	"time"
)

type randomWalkeMessage struct {
	time  int64
	value float64
	min   float64
	max   float64
}

// RunRandomCSV just for an example
func RunRandomCSV(broker *GrafanaLive, channel string, speedMillis int) {
	spread := 50.0

	walker := rand.Float64() * 100
	ticker := time.NewTicker(time.Duration(speedMillis) * time.Millisecond)

	line := randomWalkeMessage{}

	for t := range ticker.C {
		delta := rand.Float64() - 0.5
		walker += delta

		line.time = t.UnixNano() / int64(time.Millisecond)
		line.value = walker
		line.min = walker - ((rand.Float64() * spread) + 0.01)
		line.max = walker + ((rand.Float64() * spread) + 0.01)

		bytes, _ := json.Marshal(&line)
		v := broker.Publish(channel, bytes)
		if !v {
			logger.Warn("write", "channel", channel, "line", line, "ok", v)
		}
	}
}
