package kindsys

import (
	"fmt"
	"sync"

	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/cuectx"
)

// SchemaInterface represents one of Grafana's named schema interfaces.
//
// Canonical definition of schema interfaces is done in CUE. Instances of
// this type simply represent that information in Go.
// TODO link to framework docs
type SchemaInterface struct {
	name    string
	group   bool
	raw     cue.Value
	plugins []string
}

// Name returns the name of the SchemaInterface.
//
// The name is also used as the path at which a SchemaInterface lineage is defined in a
// plugin models.cue file.
func (s SchemaInterface) Name() string {
	return s.name
}

// Contract returns the cue.Value representing the meta-schema that is the
// contract between core/custom kinds that consume schemas that are instances
// of the SchemaInterface contract, and composable kinds that produce such schemas.
func (s SchemaInterface) Contract() cue.Value {
	return s.raw.LookupPath(ip)
}

var ip = cue.ParsePath("interface")

// Should indicates whether the given plugin type is expected (but not required)
// to produce a composable kind that implements this SchemaInterface.
func (s SchemaInterface) Should(plugintype string) bool {
	pt := plugintype
	for _, t := range s.plugins {
		if pt == t {
			return true
		}
	}
	return false
}

// IsGroup indicates whether the slot specifies a group lineage - one in which
// each top-level key represents a distinct schema for objects that are expected
// to exist in the wild, but objects corresponding to the root of the schema are not
// expected to exist.
func (s SchemaInterface) IsGroup() bool {
	return s.group
}

func FindSchemaInterface(name string) (SchemaInterface, error) {
	sl, has := SchemaInterfaces(nil)[name]
	if !has {
		return SchemaInterface{}, fmt.Errorf("unsupported slot: %s", name)
	}
	return sl, nil
}

var defaultIfaces map[string]SchemaInterface
var onceIfaces sync.Once

// SchemaInterfaces returns a map of all [SchemaInterface]s defined by
// Grafana's kindsys framework.
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [cue.Context], returned from [cuectx.GrafanaCUEContext]. If nil is
// passed, the singleton will be used. This is a reasonable default for external
// code, as well.
//
// TODO link to framework docs
func SchemaInterfaces(ctx *cue.Context) map[string]SchemaInterface {
	if ctx == nil || ctx == cuectx.GrafanaCUEContext() {
		// Ensure framework is loaded, even if this func is called
		// from an init() somewhere.
		onceIfaces.Do(func() {
			defaultIfaces = doSchemaInterfaces(nil)
		})
		return defaultIfaces
	}

	return doSchemaInterfaces(ctx)
}

func doSchemaInterfaces(ctx *cue.Context) map[string]SchemaInterface {
	fw := CUEFramework(ctx)

	defs := fw.LookupPath(cue.ParsePath("schemaInterfaces"))
	if !defs.Exists() {
		panic("schemaInterfaces key does not exist in kindsys framework")
	}
	type typ struct {
		Name        string   `json:"name"`
		PluginTypes []string `json:"pluginTypes"`
		Group       bool     `json:"group"`
	}

	ifaces := make(map[string]SchemaInterface)
	iter, _ := defs.Fields() //nolint:errcheck
	for iter.Next() {
		k := iter.Selector().String()
		v := &typ{}
		_ = iter.Value().Decode(&v) //nolint:errcheck,gosec
		ifaces[k] = SchemaInterface{
			name:    v.Name,
			plugins: v.PluginTypes,
			group:   v.Group,
			raw:     iter.Value(),
		}
	}

	return ifaces
}
