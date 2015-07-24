package socketio

// Namespace is the name space of socket.io handler.
type Namespace interface {

	// Name returns the name of namespace.
	Name() string

	// Of returns the namespace with given name.
	Of(name string) Namespace

	// On registers the function f to handle message.
	On(message string, f interface{}) error
}

type namespace struct {
	*baseHandler
	root map[string]Namespace
}

func newNamespace(broadcast BroadcastAdaptor) *namespace {
	ret := &namespace{
		baseHandler: newBaseHandler("", broadcast),
		root:        make(map[string]Namespace),
	}
	ret.root[ret.Name()] = ret
	return ret
}

func (n *namespace) Name() string {
	return n.baseHandler.name
}

func (n *namespace) Of(name string) Namespace {
	if name == "/" {
		name = ""
	}
	if ret, ok := n.root[name]; ok {
		return ret
	}
	ret := &namespace{
		baseHandler: newBaseHandler(name, n.baseHandler.broadcast),
		root:        n.root,
	}
	n.root[name] = ret
	return ret
}
