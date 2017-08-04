package imguploader

import (
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/util"
  "google.golang.org/api/option"
  "cloud.google.com/go/storage"
  "golang.org/x/net/context"
  "io/ioutil"
  "fmt"
)

type GCPUploader struct {
  keyFile string
  bucket  string
  log     log.Logger
}

func NewGCPUploader(keyFile, bucket string) *GCPUploader {
  return &GCPUploader{
    keyFile: keyFile,
    bucket:  bucket,
    log:     log.New("gcpuploader"),
  }
}

func (u *GCPUploader) Upload(imageDiskPath string) (string, error) {
  ctx := context.Background()

  client, err := storage.NewClient(ctx, option.WithServiceAccountFile(u.keyFile))
  if err != nil {
    return "", err
  }

  key := util.GetRandomString(20) + ".png"
  log.Debug("Uploading image to GCP bucket = %s key = %s", u.bucket, key)

  file, err := ioutil.ReadFile(imageDiskPath)
  if err != nil {
    return "", err
  }

  wc := client.Bucket(u.bucket).Object(key).NewWriter(ctx)
  wc.ContentType = "image/png"
  wc.ACL = []storage.ACLRule{{Entity: storage.AllUsers, Role: storage.RoleReader}}

  if _, err := wc.Write(file); err != nil {
    return "", err
  }

  if err := wc.Close(); err != nil {
    return "", err
  }

  return fmt.Sprintf("https://storage.googleapis.com/%s/%s", u.bucket, key), nil
}
