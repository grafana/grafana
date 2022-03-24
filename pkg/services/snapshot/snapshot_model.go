package snapshot

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// Snapshot contains information about a dashboard at a specific point
// in time.
type Snapshot struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Key         string `json:"key"`
	OrgID       int64  `json:"orgId"`
	UserID      int64  `json:"userId"`
	External    bool   `json:"external"`
	ExternalURL string `json:"externalUrl"`

	DeleteKey         string `json:"deleteKey,omitempty"`
	ExternalDeleteURL string `json:"externalDeleteUrl,omitempty"`

	Expires time.Time `json:"expires"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	Dashboard          map[string]interface{} `json:"dashboard,omitempty"`
	DashboardEncrypted []byte                 `json:"dashboardEncrypted,omitempty"`
}

// SnapshotList contains a list of metadata related to a
// dashboard snapshot
type SnapshotList []*Snapshot

type CreateCmd struct {
	Name    string `json:"name"`
	Expires int64  `json:"expires"`

	External          bool   `json:"external"`
	ExternalURL       string `json:"-"`
	ExternalDeleteURL string `json:"-"`

	Key       string `json:"key"`
	DeleteKey string `json:"deleteKey"`

	OrgID  int64 `json:"-"`
	UserID int64 `json:"-"`

	Dashboard          map[string]interface{} `json:"dashboard"`
	DashboardEncrypted []byte                 `json:"-"`
}

func (c CreateCmd) Validate() error {
	if c.Dashboard == nil {
		return fmt.Errorf("dashboard field required")
	}

	if c.External {
		if c.Key == "" {
			return fmt.Errorf("key is required when creating external snapshot")
		}
		if c.DeleteKey == "" {
			return fmt.Errorf("deleteKey is required when creating external snapshot")
		}
	}

	return nil
}

func (c CreateCmd) Skel(now time.Time) (*Snapshot, error) {
	err := c.Validate()
	if err != nil {
		return nil, err
	}

	var expires time.Time
	if c.Expires != 0 {
		expires = now.Add(time.Duration(c.Expires) * time.Second)
	}

	if c.Name == "" {
		c.Name = "Unnamed snapshot"
	}

	if c.Key == "" {
		c.Key, err = util.GetRandomString(32)
		if err != nil {
			return nil, fmt.Errorf("failed to generate random key: %w", err)
		}
	}

	if c.DeleteKey == "" {
		c.DeleteKey, err = util.GetRandomString(32)
		if err != nil {
			return nil, fmt.Errorf("failed to generate random delete key: %w", err)
		}
	}

	s := Snapshot{
		ID:                 0,
		Name:               c.Name,
		Key:                c.Key,
		OrgID:              c.OrgID,
		UserID:             c.UserID,
		External:           c.External,
		ExternalURL:        c.ExternalURL,
		DeleteKey:          c.DeleteKey,
		ExternalDeleteURL:  c.ExternalDeleteURL,
		Expires:            expires,
		Created:            now,
		Updated:            now,
		Dashboard:          c.Dashboard,
		DashboardEncrypted: c.DashboardEncrypted,
	}

	return &s, nil
}

type DeleteCmd struct {
	DeleteKey string
}

type CreateResult struct {
	Snapshot *Snapshot
}

type DeleteExpiredResult struct {
	DeletedRows int64
}

type GetByKeyQuery struct {
	Key            string
	DeleteKey      string
	IncludeSecrets bool
}

type GetResult struct {
	Snapshot *Snapshot
}

type ListQuery struct {
	Name         string
	Limit        int
	OrgID        int64
	SignedInUser *models.SignedInUser
}

type ListResult struct {
	DashboardSnapshots SnapshotList
}
