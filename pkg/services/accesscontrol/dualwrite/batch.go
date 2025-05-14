package dualwrite

// batch will call fn with a batch of T for specified size.
func batch[T any](items []T, batchSize int, fn func([]T) error) error {
	count := len(items)
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := fn(items[i:end]); err != nil {
			return err
		}

		i = end
	}
	return nil
}
