package repository

// RepositoryLimits holds all configured repository limits.
// This struct is designed to be extensible for future limit types.
type RepositoryLimits struct {
	// MaxRepositories is the maximum number of repositories allowed per namespace.
	// Default is 10, 0 in config = unlimited (converted to -1 internally as HACK), > 0 = use value
	MaxRepositories int64
}
