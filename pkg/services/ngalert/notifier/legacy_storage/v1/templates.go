package v1

import (
	"crypto/sha256"
	"fmt"
	"hash/fnv"
	"math/big"
	"regexp"
	"strings"
	"unsafe"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1/store"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

type TemplateGroup struct {
	ResourceMetadata

	Title   string
	Content string
	Kind    TemplateKind
}

func (t *TemplateGroup) ResourceType() string {
	return "template"
}

func (t *TemplateGroup) ResourceID() string {
	return t.Title
}

type TemplateKind string

const (
	TemplateKindGrafana TemplateKind = "grafana"
	TemplateKindMimir   TemplateKind = "mimir"
)

func (t *TemplateGroup) Validate() error {
	if t.Title == "" {
		return fmt.Errorf("template must have a name")
	}
	if t.Content == "" {
		return fmt.Errorf("template must have content")
	}

	content := strings.TrimSpace(t.Content)
	found, err := regexp.MatchString(`\{\{\s*define`, content)
	if err != nil {
		return fmt.Errorf("failed to match regex: %w", err)
	}
	if !found {
		lines := strings.Split(content, "\n")
		for i, s := range lines {
			lines[i] = "  " + s
		}
		content = strings.Join(lines, "\n")
		content = fmt.Sprintf("{{ define \"%s\" }}\n%s\n{{ end }}", t.Title, content)
	}
	t.Content = content
	if t.Kind == "" {
		t.Kind = TemplateKindGrafana
	}
	postable := definition.PostableApiTemplate{
		Name:    t.Title,
		Content: t.Content,
		Kind:    definition.TemplateKind(t.Kind),
	}
	if err := postable.Validate(); err != nil {
		return err
	}
	def := notify.PostableAPITemplateToTemplateDefinition(postable)
	return def.Validate()
}

// NewTemplateGroup creates a new TemplateGroup with the specified UID, name, content, kind, and provenance.
// If the UID is empty, it generates the one that a template without a UID has, see TemplateUID.
func NewTemplateGroup(uid ResourceUID, name, content string, kind TemplateKind, provenance models.Provenance) TemplateGroup {
	if uid == "" {
		uid = TemplateUID(kind, name)
	}
	return TemplateGroup{
		ResourceMetadata: ResourceMetadata{
			UID:        uid,
			Version:    calculateTemplateFingerprint(content),
			Provenance: provenance,
			Manager:    models.ProvenanceToManagerProperties(provenance),
		},
		Title:   name,
		Content: content,
		Kind:    kind,
	}
}

// TemplateFilesToTemplates converts a map of template files to a map of TemplateGroups.
// UIDs are generated deterministically based on the template name.
func TemplateFilesToTemplates(templateFiles map[string]string, kind TemplateKind) map[ResourceUID]TemplateGroup {
	if templateFiles == nil {
		return nil
	}

	templates := make(map[ResourceUID]TemplateGroup, len(templateFiles))
	for name, content := range templateFiles {
		tmpl := NewTemplateGroup("", name, content, kind, models.ProvenanceNone)
		templates[tmpl.UID] = tmpl
	}
	return templates
}

// TemplatesToTemplateFiles converts a map of TemplateGroups to a map of template files.
func TemplatesToTemplateFiles(templates map[ResourceUID]TemplateGroup) map[string]string {
	if templates == nil {
		return nil
	}

	templateFiles := make(map[string]string, len(templates))
	for _, tg := range templates {
		templateFiles[tg.Title] = tg.Content
	}
	return templateFiles
}

// ManagedTemplatesToTemplates converts a ManagedTemplates map (keyed by UID) to the internal TemplateGroup map.
// An empty or invalid UID is replaced by a deterministically generated one, see ResolveTemplateUID.
// A kind and title are unique among the stored templates because creating, updating and promoting templates check it,
// which is not checked again here.
func ManagedTemplatesToTemplates(managed map[string]store.PostableApiTemplateDB) map[ResourceUID]TemplateGroup {
	if managed == nil {
		return nil
	}
	out := make(map[ResourceUID]TemplateGroup, len(managed))
	for key, t := range managed {
		kind := TemplateKind(t.Kind)
		uid := ResolveTemplateUID(key, kind, t.Name)
		out[uid] = NewTemplateGroup(uid, t.Name, t.Content, kind, models.ProvenanceNone)
	}
	return out
}

// TemplatesToManagedTemplates converts the internal TemplateGroup map to a ManagedTemplates map keyed by UID.
func TemplatesToManagedTemplates(templates map[ResourceUID]TemplateGroup) map[string]store.PostableApiTemplateDB {
	if templates == nil {
		return nil
	}
	out := make(map[string]store.PostableApiTemplateDB, len(templates))
	for uid, tg := range templates {
		out[string(uid)] = store.PostableApiTemplateDB{
			Name:    tg.Title,
			Content: tg.Content,
			Kind:    string(tg.Kind),
		}
	}
	return out
}

// ValidateTemplateUID validates a template UID: non-empty, no ':', a valid DNS-1123 subdomain, and not longer than
// ualert.UIDMaxLength. Mirrors ValidateTimeIntervalUID.
func ValidateTemplateUID(uid string) error {
	if strings.TrimSpace(uid) == "" {
		return fmt.Errorf("template uid is required")
	}
	if strings.Contains(uid, ":") {
		return fmt.Errorf("template uid cannot contain invalid character ':'")
	}
	if len(uid) > ualert.UIDMaxLength {
		return fmt.Errorf("template uid cannot be longer than %d characters", ualert.UIDMaxLength)
	}
	if errs := k8svalidation.IsDNS1123Subdomain(uid); len(errs) > 0 {
		return fmt.Errorf("template uid must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}
	return nil
}

// ResolveTemplateUID is the UID of a stored template: the stored one, unless it is not a valid UID, in which case it is
// the one that the template has without one.
//
// Templates used to be stored under a UID derived from their kind and title that was not always valid, this is
// replaced the next time they are saved.
func ResolveTemplateUID(storedUID string, kind TemplateKind, name string) ResourceUID {
	if ValidateTemplateUID(storedUID) != nil {
		return TemplateUID(kind, name)
	}
	return ResourceUID(storedUID)
}

// TemplateUID derives a deterministic UID from the kind and title of a template. It exists only for templates whose
// persisted UID is absent or invalid.
//
// The kind is part of the calculation because a Grafana and a Mimir template can have
// the same title. Note that imported templates do not get their UID from here, see merge.MergeTemplates.
//
// The result is a fixed-length lowercase base36 string so it is always a valid Kubernetes name.
func TemplateUID(kind TemplateKind, name string) ResourceUID {
	h := sha256.Sum256([]byte("template\x00" + string(kind) + "\x00" + name))
	n := new(big.Int).SetBytes(h[:16])
	return ResourceUID(fmt.Sprintf("%025s", n.Text(36)))
}

func CalculateTemplateFingerprint(tmpl TemplateGroup) string {
	return calculateTemplateFingerprint(tmpl.Content)
}

func calculateTemplateFingerprint(t string) string {
	sum := fnv.New64()
	_, _ = sum.Write(unsafe.Slice(unsafe.StringData(t), len(t))) //nolint:gosec
	return fmt.Sprintf("%016x", sum.Sum64())
}
