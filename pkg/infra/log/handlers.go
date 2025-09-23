package log

type DisposableHandler interface {
	Close() error
}

type ReloadableHandler interface {
	Reload() error
}
