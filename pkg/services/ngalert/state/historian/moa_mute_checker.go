package historian

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type OrgAlertmanager interface {
	AlertmanagerFor(orgID int64) (notifier.Alertmanager, error)
}

// MultiOrgAlertmanagerMuteChecker implements MuteChecker using a MultiOrgAlertmanager
type MultiOrgAlertmanagerMuteChecker struct {
	moa OrgAlertmanager
}

type muteChecker interface {
	GetSilenceIds(labels data.Labels) ([]string, error)
}

// NewMultiOrgAlertmanagerMuteChecker creates a new mute checker that uses the MultiOrgAlertmanager
func NewMultiOrgAlertmanagerMuteChecker(moa OrgAlertmanager) *MultiOrgAlertmanagerMuteChecker {
	if moa == nil {
		return nil
	}
	return &MultiOrgAlertmanagerMuteChecker{
		moa: moa,
	}
}

// IsMuted checks if an alert with the given labels is muted
func (c *MultiOrgAlertmanagerMuteChecker) GetSilenceIds(orgID int64, labels data.Labels) ([]string, error) {
	if c.moa == nil {
		return nil, nil
	}

	// Get the alertmanager for this org
	am, err := c.moa.AlertmanagerFor(orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alertmanager for org %d: %w", orgID, err)
	}

	// Check if the alertmanager has the Mutes method
	// This assumes your forked alertmanager has this method

	muteAM, ok := am.(muteChecker)
	if !ok {
		// If the alertmanager doesn't support mute checking, return false
		return nil, nil
	}

	return muteAM.GetSilenceIds(labels)
}
