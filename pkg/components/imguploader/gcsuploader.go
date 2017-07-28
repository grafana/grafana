package imguploader

import (
  "github.com/grafana/grafana/pkg/log"
  "cloud.google.com/go/storage"
  "golang.org/x/net/context"
  "github.com/grafana/grafana/pkg/util"
  "os"
  "io"
)

type GCSUploader struct {
  bucket string
  public bool
  log    log.Logger
}

func NewGCSUploader(bucket string, public bool) *GCSUploader {
  return &GCSUploader{
    bucket: bucket,
    public: public,
    log:    log.New("gcsuploader"),
  }
}

func (g *GCSUploader) Upload(imageDiskPath string) (string, error) {
  ctx := context.Background()
  client, err := storage.NewClient(ctx)
  if err != nil {
    return "", err
  }
  defer client.Close()

  key := util.GetRandomString(30) + ".png"

  log.Debug("Uploading image to GCS", "bucket = ", g.bucket, "key = ", key)
  bucket := client.Bucket(g.bucket)
  obj := bucket.Object(key)

  file, err := os.Open(imageDiskPath)

  if err != nil {
    return "", err
  }

  // if flagged to be public, set it. otherwise it'll inherit the bucket ACL
  if g.public {
    if err := obj.ACL().Set(ctx, storage.AllUsers, storage.RoleReader); err != nil {
      return "", err
    }
  }

  w := obj.NewWriter(ctx)

  _, err = io.Copy(w, file)

  if err != nil {
    return "", err
  }

  if err = w.Close(); err != nil {
    return "", err
  }

  return "https://storage.googleapis.com/" + g.bucket + "/" + key, nil
}



