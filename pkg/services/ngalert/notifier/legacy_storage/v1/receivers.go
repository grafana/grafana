package v1

import (
	"fmt"
	"hash/fnv"
	"maps"
	"slices"
	"strings"
	"unsafe"

	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

// ReceiverUID returns the deterministic UID for a receiver group with the given name.
func ReceiverUID(name string) ResourceUID {
	return ResourceUID(models.NameToUid(name))
}

// ValidateReceiverUID validates a client-supplied receiver UID: non-empty, no ':', a valid
// DNS-1123 subdomain, and not longer than ualert.UIDMaxLength. Mirrors ValidateTimeIntervalUID.
func ValidateReceiverUID(uid string) error {
	if strings.TrimSpace(uid) == "" {
		return fmt.Errorf("receiver uid is required")
	}
	if strings.Contains(uid, ":") {
		return fmt.Errorf("receiver uid cannot contain invalid character ':'")
	}
	if len(uid) > ualert.UIDMaxLength {
		return fmt.Errorf("receiver uid cannot be longer than %d characters", ualert.UIDMaxLength)
	}
	if errs := k8svalidation.IsDNS1123Subdomain(uid); len(errs) > 0 {
		return fmt.Errorf("receiver uid must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}
	return nil
}

// NewReceiver builds a PostableApiReceiver with the given UID.
func NewReceiver(uid ResourceUID, name string, integrations []*PostableGrafanaReceiver, provenance models.Provenance) PostableApiReceiver {
	r := PostableApiReceiver{
		ResourceMetadata: ResourceMetadata{
			UID:        uid,
			Provenance: provenance,
		},
		Name:                    name,
		GrafanaManagedReceivers: integrations,
	}
	r.Version = ReceiverFingerprint(r)
	return r
}

// RefreshVersion updates the receiver's version to match its content.
func (r *PostableApiReceiver) RefreshVersion() {
	if r == nil {
		return
	}
	r.Version = ReceiverFingerprint(*r)
}

// AddIntegrations adds the given integrations to the receiver, updating the receiver's version.
func (r *PostableApiReceiver) AddIntegrations(integrations ...*PostableGrafanaReceiver) {
	r.GrafanaManagedReceivers = append(r.GrafanaManagedReceivers, integrations...)
	r.RefreshVersion()
}

// RemoveIntegration removes the integration with the given UID from the receiver, updating the receiver's version.
func (r *PostableApiReceiver) RemoveIntegration(uid string) *PostableGrafanaReceiver {
	idx := slices.IndexFunc(r.GrafanaManagedReceivers, func(i *PostableGrafanaReceiver) bool {
		return i.UID == uid
	})
	if idx == -1 {
		return nil
	}

	removed := r.GrafanaManagedReceivers[idx]
	r.GrafanaManagedReceivers = append(r.GrafanaManagedReceivers[:idx], r.GrafanaManagedReceivers[idx+1:]...)
	r.RefreshVersion()
	return removed
}

// ReceiverFingerprint computes a content-only fingerprint of a receiver group, deliberately excluding
// ResourceMetadata (UID/Version/Provenance) - the same invariant TimeIntervalFingerprint/
// InhibitionRuleFingerprint maintain - so stamping provenance after the fact never invalidates it.
func ReceiverFingerprint(r PostableApiReceiver) string {
	sum := fnv.New64a()
	separator := []byte{255}
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(separator)
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s))) // #nosec G103 nosemgrep: go.lang.security.audit.unsafe.use-of-unsafe-block
	}

	writeString(r.Name)
	for _, gr := range r.GrafanaManagedReceivers {
		if gr == nil {
			continue
		}
		writeString(gr.UID)
		writeString(gr.Name)
		writeString(gr.Type)
		writeString(gr.Version)
		if gr.DisableResolveMessage {
			writeBytes([]byte{1})
		} else {
			writeBytes([]byte{0})
		}
		writeBytes(gr.Settings)
		for _, k := range slices.Sorted(maps.Keys(gr.SecureSettings)) {
			writeString(k)
			writeString(gr.SecureSettings[k])
		}
	}

	return fmt.Sprintf("%016x", sum.Sum64())
}
