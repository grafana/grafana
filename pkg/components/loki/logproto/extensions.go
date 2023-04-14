package logproto

type Streams []Stream

func (xs Streams) Len() int           { return len(xs) }
func (xs Streams) Swap(i, j int)      { xs[i], xs[j] = xs[j], xs[i] }
func (xs Streams) Less(i, j int) bool { return xs[i].Labels <= xs[j].Labels }
