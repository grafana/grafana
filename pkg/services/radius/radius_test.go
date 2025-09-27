package radius

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

// Helper to build config and call applyClassMapping
func makeServiceWithMappings(mappings []*ClassToOrgRole) *serviceImpl {
	cfg := &Config{ClassMappings: mappings}
	return &serviceImpl{cfg: cfg}
}

func TestApplyClassMapping_Precedence(t *testing.T) {
	// Org 1: admin_group -> Admin, editor_group -> Editor
	mappings := []*ClassToOrgRole{
		{Class: "admin_group", OrgId: 1, OrgRole: org.RoleAdmin},
		{Class: "editor_group", OrgId: 1, OrgRole: org.RoleEditor},
	}

	s := makeServiceWithMappings(mappings)

	ext := &login.ExternalUserInfo{OrgRoles: map[int64]org.RoleType{}}

	// Apply editor first, then admin; resulting role should be Admin (higher precedence)
	s.applyClassMapping(ext, "editor_group")
	s.applyClassMapping(ext, "admin_group")

	if got := ext.OrgRoles[1]; got != org.RoleAdmin {
		t.Fatalf("expected Org 1 role Admin, got %v", got)
	}

	// Reset and apply admin then editor; admin should still win
	ext = &login.ExternalUserInfo{OrgRoles: map[int64]org.RoleType{}}
	s.applyClassMapping(ext, "admin_group")
	s.applyClassMapping(ext, "editor_group")
	if got := ext.OrgRoles[1]; got != org.RoleAdmin {
		t.Fatalf("expected Org 1 role Admin after admin then editor, got %v", got)
	}
}

func TestApplyClassMapping_MultipleOrgs(t *testing.T) {
	// mapping to different orgs
	mappings := []*ClassToOrgRole{
		{Class: "a", OrgId: 1, OrgRole: org.RoleEditor},
		{Class: "b", OrgId: 2, OrgRole: org.RoleViewer},
	}
	s := makeServiceWithMappings(mappings)
	ext := &login.ExternalUserInfo{OrgRoles: map[int64]org.RoleType{}}

	s.applyClassMapping(ext, "a")
	s.applyClassMapping(ext, "b")

	if ext.OrgRoles[1] != org.RoleEditor {
		t.Fatalf("expected org 1 editor, got %v", ext.OrgRoles[1])
	}
	if ext.OrgRoles[2] != org.RoleViewer {
		t.Fatalf("expected org 2 viewer, got %v", ext.OrgRoles[2])
	}
}
