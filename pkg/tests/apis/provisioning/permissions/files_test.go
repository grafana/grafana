package permissions

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Resource grants alone authorize file mutations; provisioning grants cannot replace
// them. Existing and new UIDs distinguish authorization from POST/PUT existence errors.
func TestIntegrationProvisioning_NoneResourceFileWrite(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, method := range []string{"POST", "PUT", "DELETE"} {
			for _, existing := range []bool{false, true} {
				if method == "DELETE" && !existing {
					continue
				}
				for _, grant := range []string{"none", "unrelated", "required"} {
					name := method + "/new/" + grant
					if existing {
						name = method + "/existing/" + grant
					}
					t.Run(version+"/"+name, func(t *testing.T) {
						uid := pt.Name()
						path := uid + ".json"
						endpoint := "repositories/" + repo + "/files/" + path
						if existing {
							pt.Do(t, h.Org1.Admin, "POST", version, endpoint, pt.Dashboard(uid, "Before")).Require(t, 200)
						}
						action := "dashboards:create"
						if existing {
							action = "dashboards:write"
						}
						if method == "DELETE" {
							action = "dashboards:delete"
						}
						var grants []resourcepermissions.SetResourcePermissionCommand
						if grant == "required" {
							grants = pt.Actions(action)
						}
						if grant == "unrelated" {
							grants = pt.Actions("provisioning.repositories:write", "provisioning.jobs:create")
						}
						u := pt.None(t, h, grants...)
						rsp := pt.Do(t, u, method, version, endpoint, pt.Dashboard(uid, "After"))
						// POST still conflicts with an existing file after authorizing its resource.
						if method == "POST" && existing && grant == "required" {
							rsp.Require(t, 409)
							data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, path))
							require.NoError(t, err)
							require.Contains(t, string(data), "Before")
							return
						}
						if method == "PUT" && !existing && grant == "required" {
							rsp.Require(t, 404)
							_, err := os.Stat(filepath.Join(h.ProvisioningPath, path))
							require.True(t, os.IsNotExist(err))
							return
						}
						if grant == "required" {
							rsp.Require(t, 200)
						} else {
							rsp.Require(t, 403)
						}
						data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, path))
						obj, getErr := h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
						wantExists := existing
						if grant == "required" {
							wantExists = method != "DELETE"
						}
						if !wantExists {
							require.True(t, os.IsNotExist(err))
							require.True(t, apierrors.IsNotFound(getErr))
							return
						}
						require.NoError(t, err)
						require.NoError(t, getErr)
						title := "Before"
						if grant == "required" {
							title = "After"
						}
						require.Contains(t, string(data), title)
						require.Equal(t, title, obj.Object["spec"].(map[string]any)["title"])
					})
				}
			}
		}
	}
}

// File listing, resource content, and raw content use different permission checks.
// Folder targets exercise exact and inherited grants; wildcard grants cover content
// reads across all targets, including unsynced directories.
func TestIntegrationProvisioning_NoneResourceAndRawFileRead(t *testing.T) {
	for _, target := range []string{"folder", "instance", "folderless"} {
		t.Run(target, func(t *testing.T) {
			h := sharedHelper(t)
			uid := pt.Name()
			folder := pt.Name()
			pt.Write(t, h, "nested/_folder.json", pt.Folder(folder, "Nested"))
			pt.Write(t, h, "nested/dashboard.json", pt.Dashboard(uid, "Private dashboard"))
			pt.Write(t, h, "README.md", []byte("Root README"))
			pt.Write(t, h, "nested/README.md", []byte("Nested README"))
			repo := pt.LocalRepo(t, h, target)
			pt.Write(t, h, "unsynced/README.md", []byte("Unsynced README"))
			type readCase struct {
				name                                    string
				grants                                  []resourcepermissions.SetResourcePermissionCommand
				root, nested, unsynced, dashboard, list bool
			}
			cases := []readCase{
				{name: "none"},
				{name: "repository", grants: pt.Actions("provisioning.repositories:read"), list: true},
				{name: "wildcard", grants: pt.Actions("folders:read"), root: true, nested: true, unsynced: true},
				{name: "dashboard", grants: pt.Actions("dashboards:read"), dashboard: true},
			}
			if target == "folder" {
				cases = append(cases,
					readCase{name: "root", grants: []resourcepermissions.SetResourcePermissionCommand{pt.Grant("folders", repo, "folders:read")}, root: true, nested: true},
					readCase{name: "nested", grants: []resourcepermissions.SetResourcePermissionCommand{pt.Grant("folders", folder, "folders:read")}, nested: true},
				)
			}
			for _, version := range pt.Versions {
				for _, tc := range cases {
					t.Run(version+"/"+tc.name, func(t *testing.T) {
						u := pt.None(t, h, tc.grants...)
						for _, file := range []struct {
							path, content string
							allowed       bool
						}{
							{"README.md", "Root README", tc.root}, {"nested/README.md", "Nested README", tc.nested}, {"unsynced/README.md", "Unsynced README", tc.unsynced},
							{"nested/dashboard.json", "Private dashboard", tc.dashboard}, {"nested/_folder.json", "Nested", tc.nested},
							{"", "nested", tc.list}, {"nested/", "dashboard.json", tc.list},
						} {
							t.Run(file.path, func(t *testing.T) {
								rsp := pt.Do(t, u, "GET", version, "repositories/"+repo+"/files/"+file.path, nil)
								if file.allowed && file.path == "nested/" {
									rsp.Require(t, 400)
									require.Contains(t, string(rsp.Body), "folder navigation not yet supported")
									return
								}
								if file.allowed {
									rsp.Require(t, 200)
									require.Contains(t, string(rsp.Body), file.content)
								} else {
									rsp.Require(t, 403)
								}
							})
						}
					})
				}
			}
		})
	}
}

// Folder grants permit explicit creation and metadata updates without provisioning
// grants. Direct directory moves and deletions remain unsupported on the synced branch.
func TestIntegrationProvisioning_NoneFolderOperations(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "unrelated", "required"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				var actions []string
				if grant == "required" {
					actions = []string{"folders:create", "folders:write"}
				}
				if grant == "unrelated" {
					actions = []string{"dashboards:create"}
				}
				u := pt.None(t, h, pt.Actions(actions...)...)
				path := pt.Name() + "/"
				endpoint := "repositories/" + repo + "/files/" + path
				rsp := pt.Do(t, u, "POST", version, endpoint, nil)
				if grant != "required" {
					rsp.Require(t, 403)
					_, err := os.Stat(filepath.Join(h.ProvisioningPath, path))
					require.True(t, os.IsNotExist(err))
					return
				}
				rsp.Require(t, 200)
				data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, path, "_folder.json"))
				require.NoError(t, err)
				metadata := pt.Response{Body: data}.Object(t)
				uid := metadata["metadata"].(map[string]any)["name"].(string)
				pt.Do(t, u, "PUT", version, endpoint, pt.Folder(uid, "Renamed")).Require(t, 200)
				folder, err := h.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, "Renamed", folder.Object["spec"].(map[string]any)["title"])
				pt.Do(t, u, "POST", version, endpoint+"child/", nil).Require(t, 200)
				pt.Do(t, u, "DELETE", version, endpoint, nil).Require(t, 405)
				pt.Do(t, u, "POST", version, "repositories/"+repo+"/files/"+pt.Name()+"/?originalPath="+path, nil).Require(t, 405)
			})
		}
	}
}

// A file move authorizes source deletion separately from the destination mutation.
// Reusing a UID needs write, while a new UID needs create; partial grants must not move it.
func TestIntegrationProvisioning_NoneFileMove(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, newUID := range []bool{false, true} {
			for _, grant := range []string{"none", "delete", "destination", "both"} {
				name := grant + "/existing"
				if newUID {
					name = grant + "/new"
				}
				t.Run(version+"/"+name, func(t *testing.T) {
					uid := pt.Name()
					source := uid + ".json"
					dest := pt.Name() + ".json"
					pt.Do(t, h.Org1.Admin, "POST", version, "repositories/"+repo+"/files/"+source, pt.Dashboard(uid, "Source")).Require(t, 200)
					destAction := "dashboards:write"
					destUID := uid
					if newUID {
						destAction = "dashboards:create"
						destUID = pt.Name()
					}
					var actions []string
					if grant == "delete" || grant == "both" {
						actions = append(actions, "dashboards:delete")
					}
					if grant == "destination" || grant == "both" {
						actions = append(actions, destAction)
					}
					u := pt.None(t, h, pt.Actions(actions...)...)
					rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/files/"+dest+"?originalPath="+source, pt.Dashboard(destUID, "Moved"))
					if grant != "both" {
						rsp.Require(t, 403)
						_, err := os.Stat(filepath.Join(h.ProvisioningPath, source))
						require.NoError(t, err)
						_, err = os.Stat(filepath.Join(h.ProvisioningPath, dest))
						require.True(t, os.IsNotExist(err))
						return
					}
					rsp.Require(t, 200)
					_, err := os.Stat(filepath.Join(h.ProvisioningPath, source))
					require.True(t, os.IsNotExist(err))
					data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, dest))
					require.NoError(t, err)
					require.Contains(t, string(data), "Moved")
				})
			}
		}
	}
}

// Submitting an existing UID under another folder must check both its stored location
// and the submitted destination, rather than trusting either location alone.
func TestIntegrationProvisioning_NoneResourceBoundaries(t *testing.T) {
	h := sharedHelper(t)
	a, b, uid := pt.Name(), pt.Name(), pt.Name()
	pt.Write(t, h, "a/_folder.json", pt.Folder(a, "A"))
	pt.Write(t, h, "b/_folder.json", pt.Folder(b, "B"))
	pt.Write(t, h, "a/dashboard.json", pt.Dashboard(uid, "Before"))
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, scope := range []string{a, b, "*"} {
			t.Run(version+"/"+scope, func(t *testing.T) {
				u := pt.None(t, h, pt.Grant("folders", scope, "dashboards:write"))
				rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/files/b/dashboard.json", pt.Dashboard(uid, "After"))
				if scope != "*" {
					rsp.Require(t, 403)
					_, err := os.Stat(filepath.Join(h.ProvisioningPath, "b/dashboard.json"))
					require.True(t, os.IsNotExist(err))
					return
				}
				rsp.Require(t, 200)
				pt.Do(t, h.Org1.Admin, "PUT", version, "repositories/"+repo+"/files/a/dashboard.json", pt.Dashboard(uid, "Before")).Require(t, 200)
				require.NoError(t, os.Remove(filepath.Join(h.ProvisioningPath, "b/dashboard.json")))
			})
		}
	}
}

// Resource grants do not make every repository file writable. Direct folder manifests
// remain protected, and unsupported raw-file mutations must preserve existing bytes.
func TestIntegrationProvisioning_NoneMetadataAndRawWriteRestrictions(t *testing.T) {
	h := sharedHelper(t)
	pt.Write(t, h, "a/_folder.json", pt.Folder(pt.Name(), "A"))
	pt.Write(t, h, "README.md", []byte("Unchanged"))
	repo := pt.LocalRepo(t, h, "folder")
	u := pt.None(t, h, pt.Actions("folders:create", "folders:write", "folders:delete", "dashboards:create", "dashboards:write", "dashboards:delete")...)
	for _, version := range pt.Versions {
		for _, method := range []string{"POST", "PUT", "DELETE"} {
			pt.Do(t, u, method, version, "repositories/"+repo+"/files/a/_folder.json", pt.Folder(pt.Name(), "Changed")).Require(t, 403)
			rsp := pt.Do(t, u, method, version, "repositories/"+repo+"/files/README.md", []byte("Changed"))
			require.GreaterOrEqual(t, rsp.Code, 400)
			data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, "README.md"))
			require.NoError(t, err)
			require.Equal(t, "Unchanged", string(data))
		}
	}
}

// Resource authorization does not enable a disabled write workflow. Even a None user
// with every dashboard mutation action must leave the read-only repository unchanged.
func TestIntegrationProvisioning_NoneWorkflowRestrictions(t *testing.T) {
	h := sharedHelper(t)
	h.CreateLocalRepo(t, common.TestRepo{Name: "readonly", SyncTarget: "folder"})
	u := pt.None(t, h, pt.Actions("dashboards:create", "dashboards:write", "dashboards:delete")...)
	for _, version := range pt.Versions {
		for _, method := range []string{"POST", "PUT", "DELETE"} {
			pt.Do(t, u, method, version, "repositories/readonly/files/dashboard.json", pt.Dashboard(pt.Name(), "Denied")).Require(t, 403)
		}
	}
	_, err := os.Stat(filepath.Join(h.ProvisioningPath, "dashboard.json"))
	require.True(t, os.IsNotExist(err))
}
