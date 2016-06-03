package metrics

//import "sync/atomic"

type SimpleTimer interface {
	Metric

	AddTiming(int64)
	Mean() float64
	Min() int64
	Max() int64
	Count() int64
}

type StandardSimpleTimer struct {
	*MetricMeta

	total int64
	count int64
	mean  float64
	min   int64
	max   int64
}

func NewSimpleTimer(meta *MetricMeta) SimpleTimer {
	return &StandardSimpleTimer{
		MetricMeta: meta,
		mean:       0,
		min:        0,
		max:        0,
		total:      0,
		count:      0,
	}
}

func RegSimpleTimer(name string, tagStrings ...string) SimpleTimer {
	tr := NewSimpleTimer(NewMetricMeta(name, tagStrings))
	MetricStats.Register(tr)
	return tr
}

func (this *StandardSimpleTimer) AddTiming(time int64) {
	if this.min > time {
		this.min = time
	}

	if this.max < time {
		this.max = time
	}

	this.total += time
	this.count++
	this.mean = float64(this.total) / float64(this.count)
}

func (this *StandardSimpleTimer) Clear() {
	this.mean = 0
	this.min = 0
	this.max = 0
	this.total = 0
	this.count = 0
}

func (this *StandardSimpleTimer) Mean() float64 {
	return this.mean
}

func (this *StandardSimpleTimer) Min() int64 {
	return this.min
}

func (this *StandardSimpleTimer) Max() int64 {
	return this.max
}

func (this *StandardSimpleTimer) Count() int64 {
	return this.count
}

func (this *StandardSimpleTimer) Snapshot() Metric {
	return &StandardSimpleTimer{
		MetricMeta: this.MetricMeta,
		mean:       this.mean,
		min:        this.min,
		max:        this.max,
		total:      this.total,
		count:      this.count,
	}
}
