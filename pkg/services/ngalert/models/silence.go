package models

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/go-openapi/strfmt"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
)

var (
	// ErrSilenceNotFound is an error for an unknown silence.
	ErrSilenceNotFound = fmt.Errorf("could not find silence")
	// ErrSilenceFailedGenerateUniqueUID is an error for failure to generate silence UID
	ErrSilenceFailedGenerateUniqueUID = errors.New("failed to generate silence UID")
)

type SilenceSettings amv2.GettableSilence

type SilenceStatus amv2.SilenceStatus

// FromDB loads silence status stored in the database.
// FromDB is part of the xorm Conversion interface.
func (st *SilenceStatus) FromDB(b []byte) error {
	str := string(b)
	*st = SilenceStatus{State: &str}
	return nil
}

// ToDB serializes silence status to be stored in the database.
// ToDB is part of the xorm Conversion interface.
func (st *SilenceStatus) ToDB() ([]byte, error) {
	return []byte(*st.State), nil
}

type Matchers amv2.Matchers

// FromDB loads matchers stored in the database.
// FromDB is part of the xorm Conversion interface.
func (m *Matchers) FromDB(b []byte) error {
	err := json.Unmarshal(b, &m)
	if err != nil {
		return fmt.Errorf("failed to convert matchers from database: %w", err)
	}
	return nil
}

// ToDB serializes matchers to be stored in the database.
// ToDB is part of the xorm Conversion interface.
func (m *Matchers) ToDB() ([]byte, error) {
	blobMatchers, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("failed to convert matchers to send to the database: %w", err)
	}
	return blobMatchers, nil
}

type Silence struct {
	ID        int64           `xorm:"pk autoincr 'id'"`
	OrgID     int64           `xorm:"org_id" json:"orgId"`
	UID       string          `xorm:"uid" json:"uid"`
	Status    SilenceStatus   `json:"status"`
	UpdatedAt strfmt.DateTime `json:"updatedAt"`
	Comment   string          `json:"comment"`
	CreatedBy string          `json:"createdBy"`
	EndsAt    strfmt.DateTime `json:"endsAt"`
	Matchers  Matchers        `json:"matchers"`
	StartsAt  strfmt.DateTime `json:"startsAt"`
}

func (s Silence) ToGettableSilence() amv2.GettableSilence {
	gettableSilence := amv2.GettableSilence{
		ID:        &s.UID,
		Status:    &amv2.SilenceStatus{State: s.Status.State},
		UpdatedAt: &s.UpdatedAt,
	}
	gettableSilence.Comment = &s.Comment
	gettableSilence.CreatedBy = &s.CreatedBy
	gettableSilence.EndsAt = &s.EndsAt
	gettableSilence.Matchers = amv2.Matchers(s.Matchers)
	gettableSilence.StartsAt = &s.StartsAt
	return gettableSilence
}

type SaveSilenceCommand struct {
	amv2.Silence
	UID   string
	OrgID int64
}

type DeleteSilenceByUIDCommand struct {
	UID   string
	OrgID int64
}

type DeleteSilenceByIDCommand struct {
	ID int64
}

type GetSilenceByUIDQuery struct {
	UID   string
	OrgID int64

	Result *Silence
}

type GetSilenceByIDQuery struct {
	ID int64

	Result *Silence
}

type GetSilencesQuery struct {
	OrgID int64

	Result []*Silence
}
