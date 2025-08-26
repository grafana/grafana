package pref

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var ErrPrefNotFound = errors.New("preference not found")
var ErrUnknownCookieType = errutil.BadRequest(
	"preferences.unknownCookieType",
	errutil.WithPublicMessage("Got an unknown cookie preference type. Expected a set containing one or more of 'functional', 'performance', or 'analytics'}"),
)

// DateStyle constants
const (
	DateStyleLocalized     = "localized"
	DateStyleInternational = "international"
	DateStyleDefault       = DateStyleLocalized // Default value
)

var ErrInvalidDateStyle = errutil.BadRequest(
	"preferences.invalidDateStyle",
	errutil.WithPublicMessage("Invalid dateStyle value. Must be 'localized' or 'international'"),
)

type Preference struct {
	ID      int64   `xorm:"pk autoincr 'id'" db:"id"`
	OrgID   int64   `xorm:"org_id" db:"org_id"`
	UserID  int64   `xorm:"user_id" db:"user_id"`
	TeamID  int64   `xorm:"team_id" db:"team_id"`
	Teams   []int64 `xorm:"extends"`
	Version int     `db:"version"`
	// Deprecated: Use HomeDashboardUID instead
	HomeDashboardID  int64               `xorm:"home_dashboard_id" db:"home_dashboard_id"`
	HomeDashboardUID string              `xorm:"home_dashboard_uid" db:"home_dashboard_uid"`
	Timezone         string              `db:"timezone"`
	WeekStart        *string             `db:"week_start"`
	Theme            string              `db:"theme"`
	Created          time.Time           `db:"created"`
	Updated          time.Time           `db:"updated"`
	JSONData         *PreferenceJSONData `xorm:"json_data" db:"json_data"`
}

func (p Preference) Cookies(typ string) bool {
	if p.JSONData == nil || p.JSONData.CookiePreferences == nil {
		return false
	}

	_, ok := p.JSONData.CookiePreferences[typ]
	return ok
}

type GetPreferenceWithDefaultsQuery struct {
	Teams  []int64
	OrgID  int64
	UserID int64
}

type GetPreferenceQuery struct {
	OrgID  int64
	UserID int64
	TeamID int64
}

type SavePreferenceCommand struct {
	UserID int64
	OrgID  int64
	TeamID int64

	// Deprecated: Use HomeDashboardUID instead
	HomeDashboardID   int64                   `json:"homeDashboardId,omitempty"`
	HomeDashboardUID  *string                 `json:"homeDashboardUID,omitempty"`
	Timezone          string                  `json:"timezone,omitempty"`
	WeekStart         string                  `json:"weekStart,omitempty"`
	Theme             string                  `json:"theme,omitempty"`
	Language          string                  `json:"language,omitempty"`
	RegionalFormat    string                  `json:"regionalFormat,omitempty"`
	DateStyle         string                  `json:"dateStyle,omitempty"`
	QueryHistory      *QueryHistoryPreference `json:"queryHistory,omitempty"`
	CookiePreferences []CookieType            `json:"cookiePreferences,omitempty"`
	Navbar            *NavbarPreference       `json:"navbar,omitempty"`
}

// Validate validates the SavePreferenceCommand
func (cmd *SavePreferenceCommand) Validate() error {
	if cmd.DateStyle != "" && cmd.DateStyle != DateStyleLocalized && cmd.DateStyle != DateStyleInternational {
		return ErrInvalidDateStyle
	}
	return nil
}

type PatchPreferenceCommand struct {
	UserID int64
	OrgID  int64
	TeamID int64

	// Deprecated: Use HomeDashboardUID instead
	HomeDashboardID   *int64                  `json:"homeDashboardId,omitempty"`
	HomeDashboardUID  *string                 `json:"homeDashboardUID,omitempty"`
	Timezone          *string                 `json:"timezone,omitempty"`
	WeekStart         *string                 `json:"weekStart,omitempty"`
	Theme             *string                 `json:"theme,omitempty"`
	Language          *string                 `json:"language,omitempty"`
	RegionalFormat    *string                 `json:"regionalFormat,omitempty"`
	DateStyle         *string                 `json:"dateStyle,omitempty"`
	QueryHistory      *QueryHistoryPreference `json:"queryHistory,omitempty"`
	CookiePreferences []CookieType            `json:"cookiePreferences,omitempty"`
	Navbar            *NavbarPreference       `json:"navbar,omitempty"`
}

// Validate validates the PatchPreferenceCommand
func (cmd *PatchPreferenceCommand) Validate() error {
	if cmd.DateStyle != nil && *cmd.DateStyle != "" &&
		*cmd.DateStyle != DateStyleLocalized && *cmd.DateStyle != DateStyleInternational {
		return ErrInvalidDateStyle
	}
	return nil
}

type PreferenceJSONData struct {
	Language          string                 `json:"language"`
	RegionalFormat    string                 `json:"regionalFormat"`
	DateStyle         string                 `json:"dateStyle"`
	QueryHistory      QueryHistoryPreference `json:"queryHistory"`
	CookiePreferences map[string]struct{}    `json:"cookiePreferences"`
	Navbar            NavbarPreference       `json:"navbar"`
}

type QueryHistoryPreference struct {
	HomeTab string `json:"homeTab"`
}

type NavbarPreference struct {
	BookmarkUrls []string `json:"bookmarkUrls"`
}

func (j *PreferenceJSONData) FromDB(data []byte) error {
	dec := json.NewDecoder(bytes.NewBuffer(data))
	dec.UseNumber()
	return dec.Decode(j)
}

func (j *PreferenceJSONData) Scan(val any) error {
	switch v := val.(type) {
	case []byte:
		if len(v) == 0 {
			return nil
		}
		return json.Unmarshal(v, &j)
	case string:
		if len(v) == 0 {
			return nil
		}
		return json.Unmarshal([]byte(v), &j)
	default:
		return fmt.Errorf("unsupported type: %T", v)
	}
}

func (j *PreferenceJSONData) Value() (driver.Value, error) {
	return j.ToDB()
}

func (j *PreferenceJSONData) ToDB() ([]byte, error) {
	if j == nil {
		return nil, nil
	}

	return json.Marshal(j)
}

func (p Preference) TableName() string { return "preferences" }

// swagger:model
// Enum: analytics,performance,functional
type CookieType string
