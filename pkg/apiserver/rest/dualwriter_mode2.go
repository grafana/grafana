package rest

type DualWriterMode2 struct {
	DualWriter
}

// NewDualWriterMode2 returns a new DualWriter in mode 2.
// Mode 2 represents writing to legacy storage and Storage and reading from legacy storage.
func NewDualWriterMode2(legacy LegacyStorage, storage Storage) *DualWriterMode2 {
	return &DualWriterMode2{*newDualWriter(legacy, storage)}
}
