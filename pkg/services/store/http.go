package store

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

// HTTPStorageService passes raw HTTP requests to a well typed storage service
type HTTPStorageService interface {
	List(c *models.ReqContext) response.Response
	Read(c *models.ReqContext) response.Response
	Delete(c *models.ReqContext) response.Response
	Upload(c *models.ReqContext) response.Response
}

type httpStorage struct {
	store StorageService
}

func ProvideHTTPService(store StorageService) HTTPStorageService {
	return &httpStorage{
		store: store,
	}
}

func (s *httpStorage) Upload(c *models.ReqContext) response.Response {

	// 32 MB is the default used by FormFile()
	if err := c.Req.ParseMultipartForm(32 << 20); err != nil {
		grafanaStorageLogger.Error("error in parsing form", err)
		return response.Error(400, "error parsing form", err)
	}
	// Get a reference to the fileHeaders.
	// They are accessible only after ParseMultipartForm is called
	files := c.Req.MultipartForm.File["file"]
	// c.Req.ParseMultipartForm(0)
	path := c.Req.FormValue("path")
	contents := []byte{}
	for _, fileHeader := range files {
		// Restrict the size of each uploaded file to 1MB.
		// TODO: To prevent the aggregate size from exceeding
		// a specified value, use the http.MaxBytesReader() method
		// before calling ParseMultipartForm()
		// if fileHeader.Size > MAX_UPLOAD_SIZE {
		//     return response.Respond(400, "The uploaded image is too big: %s. Please use an image less than 1MB in size")
		// }
		// Open the file
		file, err := fileHeader.Open()
		if err != nil {
			return response.Error(400, "error opening file", err)
		}

		// read file in chunks
		buff := make([]byte, 512)
		for {
			_, err := file.Read(buff)
			if err != nil {
				if err != io.EOF {
					grafanaStorageLogger.Error("error in reading file in chunks")
				}
				break
			}
			// create contents to send to upsert
			contents = append(contents, buff...)
		}

		if err != nil {
			return response.Error(400, "error reading file", err)
		}
		grafanaStorageLogger.Info("content", "contents", contents)

		// Create the uploads folder if it doesn't already exist
		err = os.MkdirAll("./uploads", os.ModePerm)
		if err != nil {
			return response.Error(400, "error creating new upload folder", err)
		}
		// Create a new file in the uploads directory
		dst, err := os.Create(fmt.Sprintf("./uploads/%d%s", time.Now().UnixNano(), filepath.Ext(fileHeader.Filename)))
		if err != nil {
			return response.Error(400, "error creating a new file while uploading", err)
		}

		defer dst.Close()

		// Copy the uploaded file to the filesystem
		// at the specified destination
		_, err = io.Copy(dst, file)

		if err != nil {
			return response.Error(400, "error copying the file to filesystem", err)
		}

		grafanaStorageLogger.Info("upload successfully")
	}
	action := "Upload"
	// get the path out
	// scope, path := getPathAndScope(c)
	// store, _ := s.tree.getRoot(path)

	// err := store.Upsert(c.Req.Context(), &filestorage.UpsertFileCommand{
	//  Path:     path,
	//  Contents: &contents,
	// })
	// if err != nil {
	//  return response.Error(400, "error upserting to file storage", err)
	// }

	return response.JSON(200, map[string]string{
		"action": action,
		// "scope":  scope,
		"path": path,
	})
}

func (s *httpStorage) Read(c *models.ReqContext) response.Response {
	action := "Read"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (s *httpStorage) Delete(c *models.ReqContext) response.Response {
	action := "Delete"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
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
	return response.JSONStreaming(200, frame)
}
