package schema

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var (
	// ErrUnknownSchemaType is returned when trying to load unsupported schema type.
	ErrUnknownSchemaType = errors.New("unsupported schema type")
)

// SchemaLoader is a generic schema loader that can load schemas for different schema types.
type SchemaLoader struct {
	goLoader    *GoSchemaLoader
	themaLoader *ThemaSchemaLoader
}

// ProvideSchemaLoader returns a new SchemaLoader that supports Go and Thema schema loaders.
func ProvideSchemaLoader(goLoader *GoSchemaLoader, themaLoader *ThemaSchemaLoader) *SchemaLoader {
	return &SchemaLoader{
		goLoader:    goLoader,
		themaLoader: themaLoader,
	}
}

// LoadSchema loads schema based on schema type and options.
// It's important that the options for the correct type are provided.
func (l *SchemaLoader) LoadSchema(
	ctx context.Context, typ SchemaType, themaOpts ThemaLoaderOpts, goOpts GoLoaderOpts,
) (ObjectSchema, error) {
	switch typ {
	case SchemaTypeThema:
		return l.themaLoader.LoadSchema(ctx, themaOpts)
	case SchemaTypeGo:
		return l.goLoader.LoadSchema(ctx, goOpts), nil
	default:
		return nil, ErrUnknownSchemaType
	}
}

// GoSchemaLoader loads Go schemas.
type GoSchemaLoader struct{}

// GoLoaderOpts are the options for loading Go schemas.
type GoLoaderOpts struct {
	SchemaName       string
	GroupName        string
	GroupVersion     string
	SchemaOpenapi    apiextensionsv1.JSONSchemaProps
	SchemaObject     runtime.Object
	SchemaListObject runtime.Object
}

// ProvideGoSchemaLoader returns a new GoSchemaLoader.
func ProvideGoSchemaLoader() *GoSchemaLoader {
	return &GoSchemaLoader{}
}

// LoadGoSchema loads a new Go schema with options opts.
func (l *GoSchemaLoader) LoadSchema(ctx context.Context, opts GoLoaderOpts) GoSchema {
	return NewGoSchema(
		opts.SchemaName, opts.GroupName, opts.GroupVersion, opts.SchemaOpenapi, opts.SchemaObject, opts.SchemaListObject,
	)
}

// ThemaSchemaLoader loads Thema schemas.
type ThemaSchemaLoader struct {
	lib thema.Library
}

// ThemaLoaderOpts are the options for loading Thema schemas.
type ThemaLoaderOpts struct {
	SchemaFS         fs.FS
	SchemaPath       string
	SchemaVersion    thema.SyntacticVersion
	GroupName        string                          // TODO: should be part of the lineage
	GroupVersion     string                          // TODO: should be part of the lineage
	SchemaOpenapi    apiextensionsv1.JSONSchemaProps // TODO: should be part of the lineage
	SchemaType       interface{}
	SchemaObject     runtime.Object
	SchemaListObject runtime.Object
}

// ProvideThemaSchemaLoader returns a new Thema schema loader, which uses Thema library lib for registering schemas.
func ProvideThemaSchemaLoader(lib thema.Library) *ThemaSchemaLoader {
	return &ThemaSchemaLoader{
		lib: lib,
	}
}

// LoadThemaSchema loads a new Thema schema with options opts.
func (l *ThemaSchemaLoader) LoadSchema(ctx context.Context, opts ThemaLoaderOpts) (*ThemaSchema, error) {
	lin, err := loadThemaLineage(opts.SchemaPath, opts.SchemaFS, l.lib)
	if err != nil {
		return nil, err
	}

	zsch, err := lin.Schema(opts.SchemaVersion)
	if err != nil {
		return nil, err
	}

	if err := thema.AssignableTo(zsch, opts.SchemaType); err != nil {
		return nil, err
	}

	return NewThemaSchema(
		lin, opts.GroupName, opts.GroupVersion, opts.SchemaOpenapi, opts.SchemaObject, opts.SchemaListObject,
	), nil
}

func loadThemaLineage(path string, cueFS fs.FS, lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	prefix := filepath.FromSlash(path)
	fs, err := prefixWithGrafanaCUE(prefix, cueFS)
	if err != nil {
		return nil, err
	}
	inst, err := load.InstancesWithThema(fs, prefix)

	// Need to trick loading by creating the embedded file and
	// making it look like a module in the root dir.
	if err != nil {
		return nil, err
	}

	val := lib.Context().BuildInstance(inst)

	lin, err := thema.BindLineage(val, lib, opts...)
	if err != nil {
		return nil, err
	}

	return lin, nil
}

func prefixWithGrafanaCUE(prefix string, inputfs fs.FS) (fs.FS, error) {
	m := fstest.MapFS{
		filepath.Join("cue.mod", "module.cue"): &fstest.MapFile{Data: []byte(`module: "github.com/grafana/grafana"`)},
	}

	prefix = filepath.FromSlash(prefix)
	err := fs.WalkDir(inputfs, ".", (func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		f, err := inputfs.Open(path)
		if err != nil {
			return err
		}

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		m[filepath.Join(prefix, path)] = &fstest.MapFile{Data: b}
		return nil
	}))

	return m, err
}
