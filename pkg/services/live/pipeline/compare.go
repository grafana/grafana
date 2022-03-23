package pipeline

// NumberCompareOp is an comparison operator.
type NumberCompareOp string

// Known NumberCompareOp types.
const (
	NumberCompareOpLt  NumberCompareOp = "lt"
	NumberCompareOpGt  NumberCompareOp = "gt"
	NumberCompareOpLte NumberCompareOp = "lte"
	NumberCompareOpGte NumberCompareOp = "gte"
	NumberCompareOpEq  NumberCompareOp = "eq"
	NumberCompareOpNe  NumberCompareOp = "ne"
)
