package imguploader

import (
	"fmt"
	"os"
	"path"
	"time"

	"github.com/gophercloud/gophercloud"
	"github.com/gophercloud/gophercloud/openstack"
	"github.com/gophercloud/gophercloud/openstack/objectstorage/v1/objects"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
)

type SwiftUploaderOpts struct {
	authEndpoint string
	region       string
	tenantName   string
	username     string
	password     string
	container    string
	prefix       string
	addDateDirs  bool
	imageTTLDays int
}

type SwiftUploader struct {
	authEndpoint string
	region       string
	tenantName   string
	username     string
	password     string
	container    string
	prefix       string
	addDateDirs  bool
	imageTTLDays int
	log          log.Logger
}

func NewSwiftUploader(opts SwiftUploaderOpts) *SwiftUploader {
	return &SwiftUploader{
		authEndpoint: opts.authEndpoint,
		region:       opts.region,
		tenantName:   opts.tenantName,
		username:     opts.username,
		password:     opts.password,
		container:    opts.container,
		prefix:       opts.prefix,
		addDateDirs:  opts.addDateDirs,
		imageTTLDays: opts.imageTTLDays,
		log:          log.New("swiftuploader"),
	}
}

func (u *SwiftUploader) Upload(imageDiskPath string) (string, error) {
	authOpts := gophercloud.AuthOptions{
		IdentityEndpoint: u.authEndpoint,
		Username:         u.username,
		Password:         u.password,
		TenantName:       u.tenantName,
	}

	provider, err := openstack.AuthenticatedClient(authOpts)
	if err != nil {
		return "", err
	}
	endpointOpts := gophercloud.EndpointOpts{
		Region: u.region,
	}
	client, err := openstack.NewObjectStorageV1(provider, endpointOpts)
	if err != nil {
		return "", err
	}

	file, err := os.Open(imageDiskPath)
	if err != nil {
		return "", err
	}

	createOpts := objects.CreateOpts{
		Content:     file,
		ContentType: "image/png",
	}
	if u.imageTTLDays > 0 {
		duration, err := time.ParseDuration(fmt.Sprintf("%dh", u.imageTTLDays*24))
		if err != nil {
			return "", err
		}
		createOpts.DeleteAfter = int(duration.Seconds())
	}

	relPath := getUploadPath(u.prefix, u.addDateDirs)
	log.Debug("Uploading image to swift", "container = ", u.container, ", path = ", relPath)

	result := objects.Create(client, u.container, relPath, createOpts)
	if result.Err != nil {
		return "", err
	}

	return path.Join(client.ResourceBaseURL(), u.container, relPath), nil
}

func getUploadPath(prefix string, addDateDirs bool) string {
	components := make([]string, 0, 3)
	if prefix != "" {
		components = append(components, prefix)
	}
	if addDateDirs {
		components = append(components, time.Now().Format("2006/01/02"))
	}
	components = append(components, util.GetRandomString(20)+".png")

	return path.Join(components...)
}
