package state

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"strconv"
	"sync"
)

type AlertState struct {
	UID     string
	Labels  data.Labels
	State   eval.State
	Results []eval.State
}

type cache struct {
	cacheMap map[string]AlertState
	mu       sync.Mutex
}

var stateCache cache

func Init() {
	stateCache = cache{
		cacheMap: make(map[string]AlertState, 0),
		mu:       sync.Mutex{},
	}
}

func (c *cache) getOrCreate(uid string, labels data.Labels) AlertState {
	c.mu.Lock()
	defer c.mu.Unlock()

	idString := fmt.Sprintf("%s %s", uid, labelsToString(labels))
	if state, ok := c.cacheMap[idString]; ok {
		return state
	} else {
		state := AlertState{
			UID:     uid,
			Labels:  labels,
			State:   eval.Normal,
			Results: []eval.State{},
		}
		c.cacheMap[idString] = state
		return state
	}
}

func ProcessEvalResults(uid string, results eval.Results, condition models.Condition) {
	for _, result := range results {
		currentState := stateCache.getOrCreate(uid, result.Instance)
		currentState.Results = append(currentState.Results, result.State)
		fmt.Println(currentState)
	}
}

func labelsToString(ls data.Labels) string {
	var b bytes.Buffer
	b.WriteByte('{')
	i := 0
	for k, v := range ls {
		if i > 0 {
			b.WriteByte(',')
			b.WriteByte(' ')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(strconv.Quote(v))
		i++
	}
	b.WriteByte('}')
	return b.String()
}
