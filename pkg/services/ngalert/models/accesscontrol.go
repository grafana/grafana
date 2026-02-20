package models

import (
	// #nosec G505 Used only for shortening the uid, not for security purposes.
	"crypto/sha1"
	"encoding/hex"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util"
)

const (
	ScopeReceiversRoot       = "receivers"
	ScopeInhibitionRulesRoot = "inhibition-rules"
	AlertRolesGroup          = "Alerting"

	PermissionView  ReceiverPermission = "View"
	PermissionEdit  ReceiverPermission = "Edit"
	PermissionAdmin ReceiverPermission = "Admin"

	NewReceiverScopeID = "-"
)

var (
	ScopeReceiversProvider       = ReceiverScopeProvider{accesscontrol.NewScopeProvider(ScopeReceiversRoot)}
	ScopeReceiversAll            = ScopeReceiversProvider.GetResourceAllScope()
	ScopeInhibitionRulesProvider = accesscontrol.NewScopeProvider(ScopeInhibitionRulesRoot)
	ScopeInhibitionRulesAll      = ScopeInhibitionRulesProvider.GetResourceAllScope()
)

type ReceiverScopeProvider struct {
	accesscontrol.ScopeProvider
}

func (p ReceiverScopeProvider) GetNewResourceScope() string {
	return ScopeReceiversProvider.ScopeProvider.GetResourceScopeUID(p.GetResourceIDFromUID(NewReceiverScopeID))
}

func (p ReceiverScopeProvider) GetResourceScopeUID(uid string) string {
	return ScopeReceiversProvider.ScopeProvider.GetResourceScopeUID(p.GetResourceIDFromUID(uid))
}

// GetResourceIDFromUID converts a receiver uid to a resource id. This is necessary as resource ids are limited to 40 characters.
// If the uid is already less than or equal to 40 characters, it is returned as is.
func (p ReceiverScopeProvider) GetResourceIDFromUID(uid string) string {
	if len(uid) <= util.MaxUIDLength {
		return uid
	}
	// #nosec G505 Used only for shortening the uid, not for security purposes.
	h := sha1.New()
	h.Write([]byte(uid))
	return hex.EncodeToString(h.Sum(nil))
}
