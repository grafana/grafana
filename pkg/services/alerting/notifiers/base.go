package notifiers

type NotifierBase struct {
	Name string
	Type string
}

func (n *NotifierBase) GetType() string {
	return n.Type
}
