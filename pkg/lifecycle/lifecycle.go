package lifecycle

type Event int

const (
	ApplicationStarting Event = iota
	ApplicationStarted
)

type EventHandlerFunc func()

var listeners = map[int][]EventHandlerFunc{}

func AddListener(evt Event, fn EventHandlerFunc) {
	listeners[int(evt)] = append(listeners[int(evt)], fn)
}

func Notify(evt Event) {
	for _, handler := range listeners[int(evt)] {
		handler()
	}
}
