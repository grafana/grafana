package repository

import "time"

// BuildOptions holds the construction settings consumed by repository extras.
type BuildOptions struct {
	Timeout time.Duration
}

// BuildOption configures repository construction, including secret decryption.
// Options do not affect operations on the returned repository. The last option
// for each setting wins; without options, Build adds no timeout.
type BuildOption func(*BuildOptions)

// WithTimeout bounds the Build call while respecting earlier caller deadlines
// and the existing per-decrypt timeout.
// Nonpositive values disable the additional timeout.
func WithTimeout(timeout time.Duration) BuildOption {
	return func(o *BuildOptions) {
		o.Timeout = timeout
	}
}
