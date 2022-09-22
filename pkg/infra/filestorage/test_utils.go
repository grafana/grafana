package filestorage

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type cmdErrorOutput struct {
	message  string
	args     []interface{}
	instance error
}

type cmdDelete struct {
	path  string
	error *cmdErrorOutput
}

type cmdUpsert struct {
	cmd   UpsertFileCommand
	error *cmdErrorOutput
}

type cmdCreateFolder struct {
	path  string
	error *cmdErrorOutput
}

type cmdDeleteFolder struct {
	path    string
	error   *cmdErrorOutput
	options *DeleteFolderOptions
}

type queryGetInput struct {
	path    string
	options *GetFileOptions
}

type fileNameCheck struct {
	v string
}

type filePropertiesCheck struct {
	v map[string]string
}

type fileContentsCheck struct {
	v []byte
}

type fileSizeCheck struct {
	v int64
}

type fileMimeTypeCheck struct {
	v string
}

type filePathCheck struct {
	v string
}

type listSizeCheck struct {
	v int
}

type listHasMoreCheck struct {
	v bool
}

type listLastPathCheck struct {
	v string
}

func fContents(contents []byte) interface{} {
	return fileContentsCheck{v: contents}
}

func fName(name string) interface{} {
	return fileNameCheck{v: name}
}

func fPath(path string) interface{} {
	return filePathCheck{v: path}
}

func fProperties(properties map[string]string) interface{} {
	return filePropertiesCheck{v: properties}
}
func fSize(size int64) interface{} {
	return fileSizeCheck{v: size}
}

func fMimeType(mimeType string) interface{} {
	return fileMimeTypeCheck{v: mimeType}
}

func listSize(size int) interface{} {
	return listSizeCheck{v: size}
}

func listHasMore(hasMore bool) interface{} {
	return listHasMoreCheck{v: hasMore}
}

func listLastPath(path string) interface{} {
	return listLastPathCheck{v: path}
}

func checks(c ...interface{}) []interface{} {
	return c
}

type queryGet struct {
	input  queryGetInput
	checks []interface{}
}

type queryListFilesInput struct {
	path    string
	paging  *Paging
	options *ListOptions
}

type queryListFiles struct {
	input queryListFilesInput
	list  []interface{}
	files [][]interface{}
}

type queryListFoldersInput struct {
	path    string
	options *ListOptions
}

type queryListFolders struct {
	input  queryListFoldersInput
	checks [][]interface{}
}

func interfaceName(myvar interface{}) string {
	if t := reflect.TypeOf(myvar); t.Kind() == reflect.Ptr {
		return "*" + t.Elem().Name()
	} else {
		return t.Name()
	}
}

func handleCommand(t *testing.T, ctx context.Context, cmd interface{}, cmdName string, fs FileStorage) {
	t.Helper()

	var err error
	var expectedErr *cmdErrorOutput
	switch c := cmd.(type) {
	case cmdDelete:
		err = fs.Delete(ctx, c.path)
		if c.error == nil {
			require.NoError(t, err, "%s: should be able to delete %s", cmdName, c.path)
		}
		expectedErr = c.error
	case cmdUpsert:
		err = fs.Upsert(ctx, &c.cmd)
		if c.error == nil {
			require.NoError(t, err, "%s: should be able to upsert file %s", cmdName, c.cmd.Path)
		}
		expectedErr = c.error
	case cmdCreateFolder:
		err = fs.CreateFolder(ctx, c.path)
		if c.error == nil {
			require.NoError(t, err, "%s: should be able to create folder %s", cmdName, c.path)
		}
		expectedErr = c.error
	case cmdDeleteFolder:
		err = fs.DeleteFolder(ctx, c.path, c.options)
		if c.error == nil {
			require.NoError(t, err, "%s: should be able to delete %s", cmdName, c.path)
		}
		expectedErr = c.error
	default:
		t.Fatalf("unrecognized command %s", cmdName)
	}

	if expectedErr != nil && err != nil {
		if expectedErr.instance != nil {
			require.ErrorIs(t, err, expectedErr.instance)
		}

		if expectedErr.message != "" {
			require.Errorf(t, err, expectedErr.message, expectedErr.args...)
		}
	}
}

func runChecks(t *testing.T, stepName string, path string, output interface{}, checks []interface{}) {
	if len(checks) == 0 {
		return
	}

	runFileMetadataCheck := func(file FileMetadata, check interface{}, checkName string) {
		switch c := check.(type) {
		case filePropertiesCheck:
			require.Equal(t, c.v, file.Properties, "%s-%s %s", stepName, checkName, path)
		case fileNameCheck:
			require.Equal(t, c.v, file.Name, "%s-%s %s", stepName, checkName, path)
		case fileSizeCheck:
			require.Equal(t, c.v, file.Size, "%s-%s %s", stepName, checkName, path)
		case fileMimeTypeCheck:
			require.Equal(t, c.v, file.MimeType, "%s-%s %s", stepName, checkName, path)
		case filePathCheck:
			require.Equal(t, c.v, file.FullPath, "%s-%s %s", stepName, checkName, path)
		default:
			t.Fatalf("unrecognized file check %s", checkName)
		}
	}

	switch o := output.(type) {
	case *File:
		for _, check := range checks {
			checkName := interfaceName(check)
			if fileContentsCheck, ok := check.(fileContentsCheck); ok {
				require.Equal(t, fileContentsCheck.v, o.Contents, "%s-%s %s", stepName, checkName, path)
			} else {
				runFileMetadataCheck(o.FileMetadata, check, checkName)
			}
		}
	case FileMetadata:
		for _, check := range checks {
			runFileMetadataCheck(o, check, interfaceName(check))
		}
	case *ListResponse:
		for _, check := range checks {
			c := check
			checkName := interfaceName(c)
			switch c := check.(type) {
			case listSizeCheck:
				require.Equal(t, c.v, len(o.Files), "%s %s\nReceived %s", stepName, path, o)
			case listHasMoreCheck:
				require.Equal(t, c.v, o.HasMore, "%s %s\nReceived %s", stepName, path, o)
			case listLastPathCheck:
				require.Equal(t, c.v, o.LastPath, "%s %s\nReceived %s", stepName, path, o)
			default:
				t.Fatalf("unrecognized list check %s", checkName)
			}
		}

	default:
		t.Fatalf("unrecognized output %s", interfaceName(output))
	}
}

func formatPathStructure(files []*File) string {
	if len(files) == 0 {
		return "<<EMPTY>>"
	}
	res := "\n"
	for _, f := range files {
		res = fmt.Sprintf("%s%s\n", res, f.FullPath)
	}
	return res
}

func handleQuery(t *testing.T, ctx context.Context, query interface{}, queryName string, fs FileStorage) {
	t.Helper()

	switch q := query.(type) {
	case queryGet:
		inputPath := q.input.path
		options := q.input.options
		file, fileFound, err := fs.Get(ctx, inputPath, options)
		require.NoError(t, err, "%s: should be able to get file %s", queryName, inputPath)

		if q.checks != nil && len(q.checks) > 0 {
			require.NotNil(t, file, "%s %s", queryName, inputPath)
			require.True(t, fileFound, "%s %s", queryName, inputPath)
			require.Equal(t, strings.ToLower(inputPath), strings.ToLower(file.FullPath), "%s %s", queryName, inputPath)
			runChecks(t, queryName, inputPath, file, q.checks)
		} else {
			require.Nil(t, file, "%s %s", queryName, inputPath)
			require.False(t, fileFound, "%s %s", queryName, inputPath)
		}
	case queryListFiles:
		inputPath := q.input.path
		resp, err := fs.List(ctx, inputPath, q.input.paging, q.input.options)
		require.NoError(t, err, "%s: should be able to list files in %s", queryName, inputPath)
		require.NotNil(t, resp)
		if q.list != nil && len(q.list) > 0 {
			runChecks(t, queryName, inputPath, resp, q.list)
		} else {
			require.NotNil(t, resp, "%s %s", queryName, inputPath)
			require.Equal(t, false, resp.HasMore, "%s %s", queryName, inputPath)
			require.Equal(t, 0, len(resp.Files), "%s %s", queryName, inputPath)
			require.Equal(t, "", resp.LastPath, "%s %s", queryName, inputPath)
		}

		if q.files != nil {
			require.Equal(t, len(resp.Files), len(q.files), "%s expected a check for each actual file at path: \"%s\". actual: %s", queryName, inputPath, formatPathStructure(resp.Files))
			for i, file := range resp.Files {
				runChecks(t, queryName, inputPath, file, q.files[i])
			}
		}
	case queryListFolders:
		inputPath := q.input.path
		opts := q.input.options
		if opts == nil {
			opts = &ListOptions{
				Recursive:    true,
				WithFiles:    false,
				WithFolders:  true,
				WithContents: false,
				Filter:       nil,
			}
		} else {
			opts.WithFolders = true
			opts.WithFiles = false
		}
		resp, err := fs.List(ctx, inputPath, &Paging{
			After: "",
			First: 100000,
		}, opts)
		require.NotNil(t, resp)
		require.NoError(t, err, "%s: should be able to list folders in %s", queryName, inputPath)

		if q.checks != nil {
			require.Equal(t, len(resp.Files), len(q.checks), "%s: expected a check for each actual folder at path: \"%s\". actual: %s", queryName, inputPath, formatPathStructure(resp.Files))
			for i, file := range resp.Files {
				runChecks(t, queryName, inputPath, file, q.checks[i])
			}
		} else {
			require.Equal(t, 0, len(resp.Files), "%s %s", queryName, inputPath)
		}
	default:
		t.Fatalf("unrecognized query %s", queryName)
	}
}

func executeTestStep(t *testing.T, ctx context.Context, step interface{}, stepNumber int, fs FileStorage) {
	name := fmt.Sprintf("[%d]%s", stepNumber, interfaceName(step))

	switch s := step.(type) {
	case queryGet:
		handleQuery(t, ctx, s, name, fs)
	case queryListFiles:
		handleQuery(t, ctx, s, name, fs)
	case queryListFolders:
		handleQuery(t, ctx, s, name, fs)
	case cmdUpsert:
		handleCommand(t, ctx, s, name, fs)
	case cmdDelete:
		handleCommand(t, ctx, s, name, fs)
	case cmdCreateFolder:
		handleCommand(t, ctx, s, name, fs)
	case cmdDeleteFolder:
		handleCommand(t, ctx, s, name, fs)
	default:
		t.Fatalf("unrecognized step %s", name)
	}
}
