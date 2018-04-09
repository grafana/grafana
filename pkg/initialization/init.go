package initialization

type InitFunc func() (Service, error)

var initFuncs = []InitFunc{}

func RegisterInitFunc(fn InitFunc) {
	initFuncs = append(initFuncs, fn)
}

func GetAllInitFuncs() []InitFunc {
	return initFuncs
}
