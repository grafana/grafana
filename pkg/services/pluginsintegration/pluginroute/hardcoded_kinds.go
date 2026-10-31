package pluginroute

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Everything the router knows about the kinds it authorizes by name lives in
// this file, so that replacing it with what the app manifest declares removes
// this file and nothing else.

// hardcodedKindAuth is where a kind declares that its name decides access.
// TODO: this declaration moves to the app manifest, and only ownerFromName
// and the policy fields stay here.
func hardcodedKindAuth(group, resource string) (o *ownerFromName, allowMissingParent bool) {
	if group == "collections.grafana.app" && resource == "stars" {
		return &ownerFromName{
			allowOrgAdmin: true,
			owners:        []utils.ResourceOwner{utils.UserResourceOwner},
		}, true
	}
	return nil, false
}
