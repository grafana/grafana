package store

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	"golang.org/x/sync/errgroup"
)

var errFileTooBig = response.Error(400, "Please limit file uploaded under 1MB", errors.New("file is too big"))

// HTTPStorageService passes raw HTTP requests to a well typed storage service
type HTTPStorageService interface {
	List(c *models.ReqContext) response.Response
	Read(c *models.ReqContext) response.Response
	Delete(c *models.ReqContext) response.Response
	Upload(c *models.ReqContext) response.Response

	// Dashboard/Folder hack
	GetDashboard(c *models.ReqContext) response.Response
}

type httpStorage struct {
	store StorageService
}

func ProvideHTTPService(store StorageService) HTTPStorageService {
	return &httpStorage{
		store: store,
	}
}

func UploadErrorToStatusCode(err error) int {
	switch {
	case errors.Is(err, ErrUploadFeatureDisabled):
		return 404

	case errors.Is(err, ErrUnsupportedStorage):
		return 400

	case errors.Is(err, ErrValidationFailed):
		return 400

	case errors.Is(err, ErrFileAlreadyExists):
		return 400

	default:
		return 500
	}
}

func (s *httpStorage) GetDashboard(c *models.ReqContext) response.Response {
	path := web.Params(c.Req)["*"] // path based endpoint

	// TODO: permission check!
	if strings.HasSuffix(path, ".json") {
		return response.Error(400, "invalid path, must not include .json", nil)
	}

	var err error
	var file *filestorage.File
	var frame *data.Frame
	g, ctx := errgroup.WithContext(c.Req.Context())

	g.Go(func() error {
		f, err := s.store.Read(ctx, c.SignedInUser, path+".json")
		file = f
		return err
	})
	g.Go(func() error {
		f, err := s.store.List(ctx, c.SignedInUser, path)
		frame = f.Frame
		return err
	})

	if err := g.Wait(); err != nil {
		return response.Error(500, "error running query", err)
	}

	var dto *dtos.DashboardFullWithMeta
	if file == nil {
		if frame != nil {
			dto, err = getFolderDashboard(path, frame)
			if err != nil {
				return response.Error(500, "error reading folder", err)
			}
		}
	} else {
		js, err := simplejson.NewJson(file.Contents)
		if err != nil {
			return response.Error(500, "error reading dashboard", err)
		}
		dto = &dtos.DashboardFullWithMeta{
			Dashboard: js,
			Meta: dtos.DashboardMeta{
				CanSave: true,
				CanEdit: true,
				CanStar: true,
				Slug:    path,
			},
		}
	}
	return response.JSON(200, dto)
}

func getFolderDashboard(path string, frame *data.Frame) (*dtos.DashboardFullWithMeta, error) {
	dash := models.NewDashboard(path)

	var fname *data.Field
	var ftype *data.Field
	var ftitle *data.Field
	for _, f := range frame.Fields {
		if f.Name == "title" {
			ftitle = f
		}
		if f.Name == "mediaType" {
			ftype = f
		}
		if f.Name == "name" {
			fname = f
		}
	}

	if fname == nil || ftype == nil {
		return nil, nil
	}

	count := fname.Len()
	if count < 1 {
		return nil, nil
	}

	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	paths := data.NewFieldFromFieldType(data.FieldTypeString, count)
	names.Name = "name"
	paths.Name = "path"

	for i := 0; i < count; i++ {
		name := fmt.Sprintf("%v", fname.At(i))
		name = strings.TrimSuffix(name, ".json")
		paths.Set(i, filestorage.Join(path, name))
		names.Set(i, name)

		if ftitle != nil {
			names.Set(i, ftitle.At(i))
		}
	}
	f2 := data.NewFrame("", names, paths, ftype)
	frame.SetMeta(&data.FrameMeta{
		Type: data.FrameTypeDirectoryListing,
	})

	// HACK alert... stick the listing in the first panel
	panel := map[string]interface{}{
		"__listing": f2,
	}
	arr := []interface{}{panel}
	dash.Data.Set("panels", arr)

	return &dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta: dtos.DashboardMeta{
			Slug:        path,
			FolderUid:   path,
			CanSave:     false,
			CanEdit:     false,
			IsFolder:    true,
			FolderTitle: filepath.Base(path),
		},
	}, nil
}

func (s *httpStorage) Upload(c *models.ReqContext) response.Response {
	// 32 MB is the default used by FormFile()
	if err := c.Req.ParseMultipartForm(32 << 20); err != nil {
		return response.Error(400, "error in parsing form", err)
	}
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, MAX_UPLOAD_SIZE)
	if err := c.Req.ParseMultipartForm(MAX_UPLOAD_SIZE); err != nil {
		msg := fmt.Sprintf("Please limit file uploaded under %s", util.ByteCountSI(MAX_UPLOAD_SIZE))
		return response.Error(400, msg, err)
	}

	files := c.Req.MultipartForm.File["file"]
	if len(files) != 1 {
		return response.JSON(400, map[string]interface{}{
			"message": "please upload files one at a time",
			"err":     true,
		})
	}

	fileHeader := files[0]
	if fileHeader.Size > MAX_UPLOAD_SIZE {
		return errFileTooBig
	}

	// restrict file size based on file size
	// open each file to copy contents
	file, err := fileHeader.Open()
	if err != nil {
		return response.Error(500, "Internal Server Error", err)
	}
	err = file.Close()
	if err != nil {
		return response.Error(500, "Internal Server Error", err)
	}
	data, err := ioutil.ReadAll(file)
	if err != nil {
		return response.Error(500, "Internal Server Error", err)
	}

	if (len(data)) > MAX_UPLOAD_SIZE {
		return errFileTooBig
	}

	path := RootResources + "/" + fileHeader.Filename

	mimeType := http.DetectContentType(data)

	err = s.store.Upload(c.Req.Context(), c.SignedInUser, &UploadRequest{
		Contents:              data,
		MimeType:              mimeType,
		EntityType:            EntityTypeImage,
		Path:                  path,
		OverwriteExistingFile: true,
	})

	if err != nil {
		return response.Error(UploadErrorToStatusCode(err), err.Error(), err)
	}

	return response.JSON(200, map[string]interface{}{
		"message": "Uploaded successfully",
		"path":    path,
		"file":    fileHeader.Filename,
		"err":     true,
	})
}

func (s *httpStorage) Read(c *models.ReqContext) response.Response {
	// full path is api/storage/read/upload/example.jpg, but we only want the part after read
	scope, path := getPathAndScope(c)
	file, err := s.store.Read(c.Req.Context(), c.SignedInUser, scope+"/"+path)
	if err != nil {
		return response.Error(400, "cannot call read", err)
	}

	if file == nil || file.Contents == nil {
		return response.Error(404, "file does not exist", err)
	}

	// set the correct content type for svg
	if strings.HasSuffix(path, ".svg") {
		c.Resp.Header().Set("Content-Type", "image/svg+xml")
	}
	return response.Respond(200, file.Contents)
}

func (s *httpStorage) Delete(c *models.ReqContext) response.Response {
	// full path is api/storage/delete/upload/example.jpg, but we only want the part after upload
	_, path := getPathAndScope(c)
	err := s.store.Delete(c.Req.Context(), c.SignedInUser, "/"+path)
	if err != nil {
		return response.Error(400, "cannot call delete", err)
	}
	return response.JSON(200, map[string]string{
		"message": "Removed file from storage",
		"path":    path,
	})
}

func (s *httpStorage) List(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	frame, err := s.store.List(c.Req.Context(), c.SignedInUser, path)
	if err != nil {
		return response.Error(400, "error reading path", err)
	}
	if frame == nil {
		return response.Error(404, "not found", nil)
	}
	return response.JSONStreaming(http.StatusOK, frame)
}
