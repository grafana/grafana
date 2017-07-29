package imguploader

import (
  "github.com/grafana/grafana/pkg/log"
  "cloud.google.com/go/storage"
  "golang.org/x/net/context"
  "github.com/grafana/grafana/pkg/util"
  "os"
  "io"
  "google.golang.org/api/option"
)

type GCSUploader struct {
  bucket string
  public bool
  acctJson string
  log    log.Logger
}

func NewGCSUploader(bucket, acctJson string, public bool) *GCSUploader {
  return &GCSUploader{
    bucket: bucket,
    public: public,
    acctJson: acctJson,
    log:    log.New("gcsuploader"),
  }
}

func (g *GCSUploader) Upload(imageDiskPath string) (string, error) {
  ctx := context.Background()
  var client *storage.Client
  var err error
  if g.acctJson != "" {
    client, err = storage.NewClient(ctx, option.WithServiceAccountFile(g.acctJson))
  } else {
    client, err = storage.NewClient(ctx)

  }
  if err != nil {
    return "", err
  }
  defer client.Close()

  key := util.GetRandomString(30) + ".png"

  log.Debug("Uploading image to GCS", "bucket = ", g.bucket, "key = ", key)

  file, err := os.Open(imageDiskPath)

  if err != nil {
    return "", err
  }

  wc := client.Bucket(g.bucket).Object(key).NewWriter(ctx)
  wc.ContentType = "image/png"
  if g.public {
    wc.ACL = []storage.ACLRule{{storage.AllUsers, storage.RoleReader}}
  }

  _, err = io.Copy(wc, file)

  if err != nil {
    return "", err
  }

  if err = wc.Close(); err != nil {
    return "", err
  }

  return "https://storage.googleapis.com/" + g.bucket + "/" + key, nil
}



