package teams

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func UpdateTeam(user m.SignedInUser, cmd *m.UpdateTeamCommand) error {
	return bus.Dispatch(cmd)
}
