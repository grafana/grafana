package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrSiteNotFound           = errors.New("Site not found")
)

type Site struct {
	Id        int64
	AccountId int64  `xorm:"not null unique(uix_site_for_account)"`
	Slug      string `xorm:"not null unique(uix_site_for_account)"` // The account being given access to
	Name      string
	Created   time.Time
	Updated   time.Time
}

// ---------------
// DTOs
type SiteDTO struct {
	Id        int64     `json:"id"`
	AccountId int64     `json:"account_id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
}

type NewSiteDTO struct {
	Site              *SiteDTO  `json:"site"`
	SuggestedMonitors []*SuggestedMonitor `json:"suggested_monitors"`
}

type SuggestedMonitor struct {
	Name          string              `json:"name"`
	MonitorTypeId int64               `json:"monitor_type_id"`
	Settings      []MonitorSettingDTO `json:"settings"`
}

// ----------------------
// COMMANDS
type SiteDiscoveryCommand struct {
	Site   *SiteDTO 
	Result *NewSiteDTO
}

type AddSiteCommand struct {
	AccountId int64                 `json:"-"`
	Name      string                `json:"name"`
	Result    *SiteDTO
}

type UpdateSiteCommand struct {
	Id        int64  `json:"id" binding:"required"`
	AccountId int64  `json:"-"`
	Name      string `json:"name"`
	Result    *SiteDTO
}

type DeleteSiteCommand struct {
	Id        int64 `json:"id" binding:"required"`
	AccountId int64 `json:"-"`
}

// ---------------------
// QUERIES

type GetSitesQuery struct {
	AccountId int64
	Result    []*SiteDTO
}

type GetSiteByIdQuery struct {
	Id        int64
	AccountId int64
	Result    *SiteDTO
}

func (site *Site) UpdateSiteSlug() {
	name := strings.ToLower(site.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	site.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}
