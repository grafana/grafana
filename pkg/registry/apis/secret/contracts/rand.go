package contracts

type Rand interface {
	Int64N(n int64) int64
}
