package dashboards

import ()

type Dashboard struct {
	Title string
}

type DashboardFinder interface {
	GetById(id string) (*Dashboard, error)
}

func New(typeName string) DashboardFinder {
	return &FileDatastore{}
}

type FileDatastore struct {
}

func (*FileDatastore) GetById(id string) (*Dashboard, error) {
	return nil, nil
}
