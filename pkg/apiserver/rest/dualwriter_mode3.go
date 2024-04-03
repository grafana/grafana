package rest

type DualWriterMode3 struct {
	DualWriter
}

// NewDualWriterMode3 returns a new DualWriter in mode 3.
// Mode 3 represents writing to legacy storage and Storage and reading from Storage.
func NewDualWriterMode3(legacy LegacyStorage, storage Storage) *DualWriterMode3 {
	return &DualWriterMode3{*newDualWriter(legacy, storage)}
}
