package socketio

import (
	"fmt"
	"reflect"
)

type baseHandler struct {
	events    map[string]*caller
	name      string
	broadcast BroadcastAdaptor
}

func newBaseHandler(name string, broadcast BroadcastAdaptor) *baseHandler {
	return &baseHandler{
		events:    make(map[string]*caller),
		name:      name,
		broadcast: broadcast,
	}
}

// On registers the function f to handle message.
func (h *baseHandler) On(message string, f interface{}) error {
	c, err := newCaller(f)
	if err != nil {
		return err
	}
	h.events[message] = c
	return nil
}

type socketHandler struct {
	*baseHandler
	acks   map[int]*caller
	socket *socket
	rooms  map[string]struct{}
}

func newSocketHandler(s *socket, base *baseHandler) *socketHandler {
	events := make(map[string]*caller)
	for k, v := range base.events {
		events[k] = v
	}
	return &socketHandler{
		baseHandler: &baseHandler{
			events:    events,
			broadcast: base.broadcast,
		},
		acks:   make(map[int]*caller),
		socket: s,
		rooms:  make(map[string]struct{}),
	}
}

func (h *socketHandler) Emit(message string, args ...interface{}) error {
	var c *caller
	if l := len(args); l > 0 {
		fv := reflect.ValueOf(args[l-1])
		if fv.Kind() == reflect.Func {
			var err error
			c, err = newCaller(args[l-1])
			if err != nil {
				return err
			}
			args = args[:l-1]
		}
	}
	args = append([]interface{}{message}, args...)
	if c != nil {
		id, err := h.socket.sendId(args)
		if err != nil {
			return err
		}
		h.acks[id] = c
		return nil
	}
	return h.socket.send(args)
}

func (h *socketHandler) Rooms() []string {
	ret := make([]string, len(h.rooms))
	i := 0
	for room := range h.rooms {
		ret[i] = room
		i++
	}
	return ret
}

func (h *socketHandler) Join(room string) error {
	if err := h.baseHandler.broadcast.Join(h.broadcastName(room), h.socket); err != nil {
		return err
	}
	h.rooms[room] = struct{}{}
	return nil
}

func (h *socketHandler) Leave(room string) error {
	if err := h.baseHandler.broadcast.Leave(h.broadcastName(room), h.socket); err != nil {
		return err
	}
	delete(h.rooms, room)
	return nil
}

func (h *socketHandler) LeaveAll() error {
	for room := range h.rooms {
		if err := h.baseHandler.broadcast.Leave(h.broadcastName(room), h.socket); err != nil {
			return err
		}
	}
	return nil
}

func (h *baseHandler) BroadcastTo(room, message string, args ...interface{}) error {
	return h.broadcast.Send(nil, h.broadcastName(room), message, args...)
}

func (h *socketHandler) BroadcastTo(room, message string, args ...interface{}) error {
	return h.baseHandler.broadcast.Send(h.socket, h.broadcastName(room), message, args...)
}

func (h *baseHandler) broadcastName(room string) string {
	return fmt.Sprintf("%s:%s", h.name, room)
}

func (h *socketHandler) onPacket(decoder *decoder, packet *packet) ([]interface{}, error) {
	var message string
	switch packet.Type {
	case _CONNECT:
		message = "connection"
	case _DISCONNECT:
		message = "disconnection"
	case _ERROR:
		message = "error"
	case _ACK:
	case _BINARY_ACK:
		return nil, h.onAck(packet.Id, decoder, packet)
	default:
		message = decoder.Message()
	}
	c, ok := h.events[message]
	if !ok {
		return nil, nil
	}
	args := c.GetArgs()
	olen := len(args)
	if len(args) > 0 {
		packet.Data = &args
		if err := decoder.DecodeData(packet); err != nil {
			return nil, err
		}
	}
	for i := len(args); i < olen; i++ {
		args = append(args, nil)
    }

	retV := c.Call(h.socket, args)
	if len(retV) == 0 {
		return nil, nil
	}
	ret := make([]interface{}, len(retV))
	for i, v := range retV {
		ret[i] = v.Interface()
	}
	return ret, nil
}

func (h *socketHandler) onAck(id int, decoder *decoder, packet *packet) error {
	c, ok := h.acks[id]
	if !ok {
		return nil
	}
	delete(h.acks, id)

	args := c.GetArgs()
	packet.Data = &args
	if err := decoder.DecodeData(packet); err != nil {
		return err
	}
	c.Call(h.socket, args)
	return nil
}
