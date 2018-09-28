package datasources

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

type DataSourceService interface {
	GetById(id int64, user *models.SignedInUser) (*models.DataSource, error)
}

type DataSourceServiceImpl struct {
	log      log.Logger
	Cfg      *setting.Cfg       `inject:""`
	Guardian DataSourceGuardian `inject:""`
}

func init() {
	registry.RegisterService(&DataSourceServiceImpl{})
	registry.RegisterService(&DataSourceGuardianNoop{})
}

func (srv *DataSourceServiceImpl) Init() error {
	srv.log = log.New("datasources")
	srv.log.Info("hello", "guardian", srv.Guardian.GetPermission(0, nil))
	return nil
}

func (srv *DataSourceServiceImpl) GetById(id int64, user *models.SignedInUser) {
	// check cache
	// Get by id from db
	// check permissions
}

type DataSourceGuardian interface {
	GetPermission(id int64, user *models.SignedInUser) bool
}

type DataSourceGuardianNoop struct {
}

func (dsg *DataSourceGuardianNoop) Init() error {
	return nil
}

func (dsg *DataSourceGuardianNoop) GetPermission(id int64, user *models.SignedInUser) bool {
	return false
}
