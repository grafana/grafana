package rest

type DualWriterMode1 struct {
	DualWriter
}

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to legacy storage and reading from legacy storage.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	return &DualWriterMode1{*newDualWriter(legacy, storage)}
}
