package metrics

//import "sync/atomic"

type Timer interface {
	AddTiming(int64)
	Clear()
	Avg() int64
	Min() int64
	Max() int64
	Total() int64
}

func NewTimer() Timer {
	return &StandardTimer{
		avg:   0,
		min:   0,
		max:   0,
		total: 0,
		count: 0,
	}
}

func (this *StandardTimer) AddTiming(time int64) {
	if this.min > time {
		this.min = time
	}

	if this.max < time {
		this.max = time
	}

	this.total += time
	this.count++

	this.avg = this.total / this.count
}

func (this *StandardTimer) Clear() {
	this.avg = 0
	this.min = 0
	this.max = 0
	this.total = 0
	this.count = 0
}

func (this *StandardTimer) Avg() int64 {
	return this.avg
}

func (this *StandardTimer) Min() int64 {
	return this.min
}

func (this *StandardTimer) Max() int64 {
	return this.max
}

func (this *StandardTimer) Total() int64 {
	return this.total
}

type StandardTimer struct {
	total int64
	count int64
	avg   int64
	min   int64
	max   int64
}
