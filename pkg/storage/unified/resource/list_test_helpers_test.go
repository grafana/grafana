package resource

type docListIterator struct {
	values [][]byte
	pos    int
}

func (i *docListIterator) Next() bool             { i.pos++; return i.pos <= len(i.values) }
func (*docListIterator) Error() error             { return nil }
func (*docListIterator) ContinueToken() string    { return "" }
func (i *docListIterator) ResourceVersion() int64 { return int64(i.pos) }
func (*docListIterator) Namespace() string        { return "ns" }
func (*docListIterator) Name() string             { return "name" }
func (*docListIterator) Folder() string           { return "" }
func (i *docListIterator) Value() []byte          { return i.values[i.pos-1] }
