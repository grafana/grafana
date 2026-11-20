package sso

import (
	"context"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	settingsvc "github.com/grafana/grafana/pkg/services/setting"
)

// fakeSettings is an MT-Settings double implementing both the
// reader (List) and writer (Upsert/Delete) sides.
type fakeSettings struct {
	settingsvc.Service
	us         map[string]*settingsvc.Setting
	seeded     []*settingsvc.Setting
	upserts    map[string]string
	deleted    []string
	namespaces map[string]bool
	listErr    error
}

func newFakeSettings(seed ...*settingsvc.Setting) *fakeSettings {
	f := &fakeSettings{
		us:         map[string]*settingsvc.Setting{},
		upserts:    map[string]string{},
		namespaces: map[string]bool{},
	}
	for _, r := range seed {
		if r.Labels["source"] == "us" {
			f.us[rowKey(r.Section, r.Key)] = r
		} else {
			f.seeded = append(f.seeded, r)
		}
	}
	return f
}

func (f *fakeSettings) List(_ context.Context, sel metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	var out []*settingsvc.Setting
	for _, r := range f.seeded {
		if sectionMatches(sel, r.Section) {
			out = append(out, r)
		}
	}
	for _, r := range f.us {
		if sectionMatches(sel, r.Section) {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeSettings) Upsert(ctx context.Context, s *settingsvc.Setting) error {
	f.upserts[rowKey(s.Section, s.Key)] = s.Value
	f.us[rowKey(s.Section, s.Key)] = usRow(s.Section, s.Key, s.Value)
	f.recordNamespace(ctx)
	return nil
}

func (f *fakeSettings) Delete(ctx context.Context, section, key string) error {
	f.deleted = append(f.deleted, rowKey(section, key))
	delete(f.us, rowKey(section, key))
	f.recordNamespace(ctx)
	return nil
}

func (f *fakeSettings) recordNamespace(ctx context.Context) {
	ns, _ := request.NamespaceFrom(ctx)
	f.namespaces[ns] = true
}

func sectionMatches(sel metav1.LabelSelector, section string) bool {
	if want, ok := sel.MatchLabels["section"]; ok {
		return section == want
	}
	for _, req := range sel.MatchExpressions {
		if req.Key == "section" && req.Operator == metav1.LabelSelectorOpIn {
			return slices.Contains(req.Values, section)
		}
	}
	return false
}

func rowKey(section, key string) string { return section + "|" + key }

func usRow(section, key, value string) *settingsvc.Setting {
	return &settingsvc.Setting{Section: section, Key: key, Value: value, Labels: map[string]string{"source": "us"}}
}

func defaultRow(section, key, value string) *settingsvc.Setting {
	return &settingsvc.Setting{Section: section, Key: key, Value: value, Labels: map[string]string{"source": "defaults"}}
}
