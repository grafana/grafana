package exploremap

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrExploreMapNotFound      = errors.New("explore map not found")
	ErrCommandValidationFailed = errors.New("command missing required fields")
)

// ExploreMap model
type ExploreMap struct {
	ID        int64     `json:"id" xorm:"pk autoincr 'id'"`
	UID       string    `json:"uid" xorm:"uid"`
	Title     string    `json:"title" xorm:"title"`
	Data      string    `json:"data" xorm:"data"` // JSON-encoded ExploreMapState
	OrgID     int64     `json:"-" xorm:"org_id"`
	CreatedBy int64     `json:"createdBy" xorm:"created_by"`
	UpdatedBy int64     `json:"updatedBy" xorm:"updated_by"`
	CreatedAt time.Time `json:"createdAt" xorm:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" xorm:"updated_at"`
}

type ExploreMapDTO struct {
	UID       string    `json:"uid"`
	Title     string    `json:"title"`
	Data      string    `json:"data"`
	CreatedBy int64     `json:"createdBy"`
	UpdatedBy int64     `json:"updatedBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ExploreMaps []*ExploreMap

//
// COMMANDS
//

type CreateExploreMapCommand struct {
	UID       string `json:"uid"`
	Title     string `json:"title" binding:"Required"`
	Data      string `json:"data"`
	OrgID     int64  `json:"-"`
	CreatedBy int64  `json:"-"`
}

type UpdateExploreMapCommand struct {
	UID       string `json:"uid"`
	Title     string `json:"title"`
	Data      string `json:"data"`
	OrgID     int64  `json:"-"`
	UpdatedBy int64  `json:"-"`
}

type DeleteExploreMapCommand struct {
	UID   string
	OrgID int64
}

//
// QUERIES
//

type GetExploreMapsQuery struct {
	OrgID int64
	Limit int
}

type GetExploreMapByUIDQuery struct {
	UID   string
	OrgID int64
}
