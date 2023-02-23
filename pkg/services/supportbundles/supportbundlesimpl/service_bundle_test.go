package supportbundlesimpl

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"testing"

	"filippo.io/age"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	testAgePublicKey   = "age15xgfm9gg89nz92pqjat2hy9h7lpwwfwwgvchg67lqtzzhjtmg5vq9utnd4"
	testAgePrivateKey  = "AGE-SECRET-KEY-1HGMLT8VSC95UXN2R5LUZECXT42WW7TSEYQKCWLX7PKH3YHS6HGCQ0XVEFD"
	testAgePublicKey2  = "age1q02sf508xetfa5ztzhuw0hxweyd50n27qndufaffvdth25knueds8w99c5"
	testAgePrivateKey2 = "AGE-SECRET-KEY-1DSW2P60F2ZRY4D4M57PEKTFVYCXXDYYZ0VZWG5RTUZCWHR3EJ9TQP92JXQ"
)

func TestService_bundleCreate(t *testing.T) {
	s := &Service{
		log:            log.New("test"),
		bundleRegistry: bundleregistry.ProvideService(),
		store:          newStore(kvstore.NewFakeKVStore()),
	}

	cfg := setting.NewCfg()

	collector := basicCollector(cfg)
	s.bundleRegistry.RegisterSupportItemCollector(collector)

	createdBundle, err := s.store.Create(context.Background(), &user.SignedInUser{UserID: 1, Login: "bob"})
	require.NoError(t, err)

	s.startBundleWork(context.Background(), []string{collector.UID}, createdBundle.UID)

	bundle, err := s.get(context.Background(), createdBundle.UID)
	require.NoError(t, err)

	assert.Equal(t, createdBundle.UID, bundle.UID)
	assert.Equal(t, supportbundles.StateComplete, bundle.State)
	assert.Equal(t, "bob", bundle.Creator)
	assert.NotZero(t, len(bundle.TarBytes))

	confirmFilesInTar(t, bundle.TarBytes)
}

func TestService_bundleEncryptDecrypt(t *testing.T) {
	s := &Service{
		log:                  log.New("test"),
		bundleRegistry:       bundleregistry.ProvideService(),
		store:                newStore(kvstore.NewFakeKVStore()),
		encryptionPublicKeys: []string{testAgePublicKey},
	}

	cfg := setting.NewCfg()

	collector := basicCollector(cfg)
	s.bundleRegistry.RegisterSupportItemCollector(collector)

	createdBundle, err := s.store.Create(context.Background(), &user.SignedInUser{UserID: 1, Login: "bob"})
	require.NoError(t, err)

	s.startBundleWork(context.Background(), []string{collector.UID}, createdBundle.UID)

	bundle, err := s.get(context.Background(), createdBundle.UID)
	require.NoError(t, err)

	assert.Equal(t, createdBundle.UID, bundle.UID)
	assert.Equal(t, supportbundles.StateComplete, bundle.State)
	assert.Equal(t, "bob", bundle.Creator)
	assert.NotZero(t, len(bundle.TarBytes))

	tarBytes := decryptTar(t, bundle.TarBytes, testAgePrivateKey)
	assert.NotZero(t, len(tarBytes))

	confirmFilesInTar(t, tarBytes)
}

func TestService_bundleEncryptDecryptMultipleRecipients(t *testing.T) {
	s := &Service{
		log:                  log.New("test"),
		bundleRegistry:       bundleregistry.ProvideService(),
		store:                newStore(kvstore.NewFakeKVStore()),
		encryptionPublicKeys: []string{testAgePublicKey, testAgePublicKey2},
	}

	cfg := setting.NewCfg()

	collector := basicCollector(cfg)
	s.bundleRegistry.RegisterSupportItemCollector(collector)

	createdBundle, err := s.store.Create(context.Background(), &user.SignedInUser{UserID: 1, Login: "bob"})
	require.NoError(t, err)

	s.startBundleWork(context.Background(), []string{collector.UID}, createdBundle.UID)

	bundle, err := s.get(context.Background(), createdBundle.UID)
	require.NoError(t, err)

	assert.Equal(t, createdBundle.UID, bundle.UID)
	assert.Equal(t, supportbundles.StateComplete, bundle.State)
	assert.Equal(t, "bob", bundle.Creator)
	assert.NotZero(t, len(bundle.TarBytes))

	tarBytes := decryptTar(t, bundle.TarBytes, testAgePrivateKey)
	assert.NotZero(t, len(tarBytes))

	confirmFilesInTar(t, tarBytes)

	tarBytes2 := decryptTar(t, bundle.TarBytes, testAgePrivateKey2)
	assert.NotZero(t, len(tarBytes2))

	confirmFilesInTar(t, tarBytes2)
}

func decryptTar(t *testing.T, tarBytes []byte, privateKey string) []byte {
	reader := bytes.NewReader(tarBytes)
	t.Helper()
	recipientPK, err := age.ParseX25519Identity(privateKey)
	require.NoError(t, err)

	tarBytesReader, err := age.Decrypt(reader, recipientPK)
	require.NoError(t, err)

	newTarBytes, err := io.ReadAll(tarBytesReader)
	require.NoError(t, err)
	return newTarBytes
}

// Check that the tarball contains the expected files
func confirmFilesInTar(t *testing.T, tarBytes []byte) {
	t.Helper()
	r := bytes.NewReader(tarBytes)
	gzipReader, err := gzip.NewReader(r)
	require.NoError(t, err)

	tr := tar.NewReader(gzipReader)
	files := []string{}
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)

		files = append(files, hdr.Name)
	}

	assert.ElementsMatch(t, []string{"/bundle/basic.json"}, files)
}
