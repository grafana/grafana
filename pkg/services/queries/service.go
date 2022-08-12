package queries

type Service interface {
}

type service struct {
}

func ProvideService() Service {
	return &service{}
}
