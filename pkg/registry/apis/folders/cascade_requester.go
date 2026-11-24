package folders

import (
	"encoding/json"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validation"

	authlib "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// annoKeyCascadeDeleteRequester is server-owned: it records who asked to delete a cascade folder.
const annoKeyCascadeDeleteRequester = "folder.grafana.app/cascade-delete-requester"

type cascadeDeleteRequester struct {
	Sub        string `json:"sub"`
	Identifier string `json:"identifier"`
	Type       string `json:"type"`
}

// cascadeDeleteRequesterValue returns the annotation value for user and service-account requesters,
// and an empty string for any other identity type.
func cascadeDeleteRequesterValue(user identity.Requester) (string, error) {
	if !user.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		return "", nil
	}
	b, err := json.Marshal(cascadeDeleteRequester{
		Sub:        user.GetSubject(),
		Identifier: user.GetIdentifier(),
		Type:       string(user.GetIdentityType()),
	})
	return string(b), err
}

// restoreCascadeDeleteRequester puts back an annotation a whole-object PUT omitted; a changed value is rejected in validation.
func restoreCascadeDeleteRequester(f, old *foldersv1.Folder) {
	v, ok := old.Annotations[annoKeyCascadeDeleteRequester]
	if _, has := f.Annotations[annoKeyCascadeDeleteRequester]; ok && !has {
		if f.Annotations == nil {
			f.Annotations = map[string]string{}
		}
		f.Annotations[annoKeyCascadeDeleteRequester] = v
	}
}

// validateCascadeDeleteRequester rejects an update that changes the annotation.
func validateCascadeDeleteRequester(f, old *foldersv1.Folder) error {
	got, gotOK := f.Annotations[annoKeyCascadeDeleteRequester]
	want, wantOK := old.Annotations[annoKeyCascadeDeleteRequester]
	if got == want && gotOK == wantOK {
		return nil
	}
	return apierrors.NewBadRequest(fmt.Sprintf("annotation %q is server-owned and cannot be set", annoKeyCascadeDeleteRequester))
}

// annotationsFit reports whether setting the requester annotation to value keeps f within the total annotation size limit.
func annotationsFit(f *foldersv1.Folder, value string) bool {
	if value == "" {
		return true
	}
	size := len(annoKeyCascadeDeleteRequester) + len(value)
	for k, v := range f.Annotations {
		if k != annoKeyCascadeDeleteRequester {
			size += len(k) + len(v)
		}
	}
	return size <= validation.TotalAnnotationSizeLimitB
}
