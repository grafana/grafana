package orgimpl

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) org.Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) GetIDForNewUser(cmd user.CreateUserCommand) (int64, error) {
	var orga org.Org
	if cmd.SkipOrgSetup {
		return -1, nil
	}

	if setting.AutoAssignOrg && cmd.OrgID != 0 {
		_, err := s.store.Get(cmd.OrgID)
		if err != nil {
			return -1, err
		}
		return cmd.OrgID, nil
	}

	orgName := cmd.OrgName
	if len(orgName) == 0 {
		orgName = util.StringsFallback2(cmd.Email, cmd.Login)
	}

	if setting.AutoAssignOrg {
		orga, err := s.store.Get(cmd.OrgID)
		if err != nil {
			return 0, err
		}
		if orga.ID != 0 {
			return orga.ID, nil
		}
		if setting.AutoAssignOrgId != 1 {
			// sqlog.Error("Could not create user: organization ID does not exist", "orgID",
			// 	setting.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				setting.AutoAssignOrgId)
		}
		orga.Name = MainOrgName
		orga.ID = int64(setting.AutoAssignOrgId)
	} else {
		orga.Name = orgName
	}

	orga.Created = time.Now()
	orga.Updated = time.Now()

	return s.store.CreateIsh(&orga)
}
