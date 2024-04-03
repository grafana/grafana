package rest

type DualWriterMode4 struct {
	DualWriter
}

// NewDualWriterMode4 returns a new DualWriter in mode 4.
// Mode 4 represents writing and reading from Storage.
func NewDualWriterMode4(legacy LegacyStorage, storage Storage) *DualWriterMode4 {
	return &DualWriterMode4{*newDualWriter(legacy, storage)}
}
