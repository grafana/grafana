package log

type DisposableHandler interface {
	Close()
}

type ReloadableHandler interface {
	Reload()
}
