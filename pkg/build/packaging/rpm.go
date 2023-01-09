package packaging

import (
	"bytes"
	"crypto"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	// Consider switching this over to a community fork unless there is
	// an option to move us away from OpenPGP.
	"golang.org/x/crypto/openpgp"        //nolint:staticcheck
	"golang.org/x/crypto/openpgp/armor"  //nolint:staticcheck
	"golang.org/x/crypto/openpgp/packet" //nolint:staticcheck

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/grafana/grafana/pkg/infra/fs"
)

// UpdateRPMRepo updates the RPM repository with the new release.
func UpdateRPMRepo(cfg PublishConfig, workDir string) error {
	if cfg.ReleaseMode.Mode != config.TagMode {
		panic(fmt.Sprintf("Unsupported version mode %s", cfg.ReleaseMode.Mode))
	}

	if cfg.ReleaseMode.IsTest && cfg.Config.RPMRepoBucket == DefaultRPMRepoBucket {
		return fmt.Errorf("in test-release mode, the default RPM repo bucket shouldn't be used")
	}

	if err := downloadRPMs(cfg, workDir); err != nil {
		return err
	}

	repoRoot, err := fsutil.CreateTempDir("rpm-repo")
	if err != nil {
		return err
	}
	defer func() {
		if err := os.RemoveAll(repoRoot); err != nil {
			log.Printf("Failed to remove %q: %s\n", repoRoot, err.Error())
		}
	}()

	repoName := "rpm"
	if cfg.ReleaseMode.IsBeta {
		repoName = "rpm-beta"
	}
	folderURI := fmt.Sprintf("gs://%s/%s/%s", cfg.RPMRepoBucket, strings.ToLower(string(cfg.Edition)), repoName)

	// Download the RPM database
	log.Printf("Downloading RPM database from GCS (%s)...\n", folderURI)
	//nolint:gosec
	cmd := exec.Command("gsutil", "-m", "rsync", "-r", "-d", folderURI, repoRoot)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to download RPM database from GCS: %w\n%s", err, output)
	}

	// Add the new release to the repo
	var sfx string
	switch cfg.Edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = EnterpriseSfx
	default:
		return fmt.Errorf("unsupported edition %q", cfg.Edition)
	}
	allRPMs, err := filepath.Glob(filepath.Join(workDir, fmt.Sprintf("grafana%s-*.rpm", sfx)))
	if err != nil {
		return fmt.Errorf("failed to list RPMs in %q: %w", workDir, err)
	}
	rpms := []string{}
	for _, rpm := range allRPMs {
		if strings.Contains(rpm, "-latest") {
			continue
		}

		rpms = append(rpms, rpm)
	}
	// XXX: What does the following comment mean?
	// adds to many files for enterprise
	for _, rpm := range rpms {
		if err := fs.CopyFile(rpm, filepath.Join(repoRoot, filepath.Base(rpm))); err != nil {
			return err
		}
	}

	//nolint:gosec
	cmd = exec.Command("createrepo", repoRoot)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create repo at %q: %w\n%s", repoRoot, err, output)
	}

	if err := signRPMRepo(repoRoot, cfg); err != nil {
		return err
	}

	// Update the repo in GCS

	// Sync packages first to avoid cache misses
	if cfg.DryRun {
		log.Printf("Simulating upload of RPMs to GCS (%s)\n", folderURI)
	} else {
		log.Printf("Uploading RPMs to GCS (%s)...\n", folderURI)
		args := []string{"-m", "cp"}
		args = append(args, rpms...)
		args = append(args, folderURI)
		//nolint:gosec
		cmd = exec.Command("gsutil", args...)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to upload RPMs to GCS: %w\n%s", err, output)
		}
	}

	if cfg.DryRun {
		log.Printf("Simulating upload of RPM repo metadata to GCS (%s)\n", folderURI)
	} else {
		log.Printf("Uploading RPM repo metadata to GCS (%s)...\n", folderURI)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-m", "rsync", "-r", "-d", repoRoot, folderURI)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to upload RPM repo metadata to GCS: %w\n%s", err, output)
		}
		allRepoResources := fmt.Sprintf("%s/**/*", folderURI)
		log.Printf("Setting cache ttl for RPM repo resources on GCS (%s)...\n", allRepoResources)
		//nolint:gosec
		cmd = exec.Command("gsutil", "-m", "setmeta", "-h", CacheSettings+cfg.TTL, allRepoResources)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to set cache ttl for RPM repo resources on GCS: %w\n%s", err, output)
		}
	}

	return nil
}

// downloadRPMs downloads RPM packages.
func downloadRPMs(cfg PublishConfig, workDir string) error {
	if !strings.HasSuffix(workDir, string(filepath.Separator)) {
		workDir += string(filepath.Separator)
	}
	var version string
	if cfg.ReleaseMode.Mode == config.TagMode {
		if cfg.ReleaseMode.IsBeta {
			version = strings.ReplaceAll(cfg.Version, "-", "~")
		} else {
			version = cfg.Version
		}
	}
	if version == "" {
		panic(fmt.Sprintf("Unrecognized version mode %s", cfg.ReleaseMode.Mode))
	}

	var sfx string
	switch cfg.Edition {
	case config.EditionOSS:
	case config.EditionEnterprise:
		sfx = EnterpriseSfx
	default:
		return fmt.Errorf("unrecognized edition %q", cfg.Edition)
	}

	u := fmt.Sprintf("gs://%s/%s/%s/grafana%s-%s-*.*.rpm*", cfg.Bucket,
		strings.ToLower(string(cfg.Edition)), ReleaseFolder, sfx, version)
	log.Printf("Downloading RPM packages %q...\n", u)
	args := []string{
		"-m",
		"cp",
		u,
		workDir,
	}
	//nolint:gosec
	cmd := exec.Command("gsutil", args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to download RPM packages %q: %w\n%s", u, err, output)
	}

	return nil
}

func getPublicKey(cfg PublishConfig) (*packet.PublicKey, error) {
	f, err := os.Open(cfg.GPGPublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to open %q: %w", cfg.GPGPublicKey, err)
	}
	defer func(f *os.File) {
		err := f.Close()
		if err != nil {
			return
		}
	}(f)

	block, err := armor.Decode(f)
	if err != nil {
		return nil, err
	}

	if block.Type != openpgp.PublicKeyType {
		return nil, fmt.Errorf("invalid public key block type: %q", block.Type)
	}

	packetReader := packet.NewReader(block.Body)
	pkt, err := packetReader.Next()
	if err != nil {
		return nil, err
	}

	key, ok := pkt.(*packet.PublicKey)
	if !ok {
		return nil, fmt.Errorf("got non-public key from packet reader: %T", pkt)
	}

	return key, nil
}

func getPrivateKey(cfg PublishConfig) (*packet.PrivateKey, error) {
	f, err := os.Open(cfg.GPGPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to open %q: %w", cfg.GPGPrivateKey, err)
	}
	defer func(f *os.File) {
		err := f.Close()
		if err != nil {
			return
		}
	}(f)

	passphraseB, err := os.ReadFile(cfg.GPGPassPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read %q: %w", cfg.GPGPrivateKey, err)
	}
	passphraseB = bytes.TrimSuffix(passphraseB, []byte("\n"))

	block, err := armor.Decode(f)
	if err != nil {
		return nil, err
	}

	if block.Type != openpgp.PrivateKeyType {
		return nil, fmt.Errorf("invalid private key block type: %q", block.Type)
	}

	packetReader := packet.NewReader(block.Body)
	pkt, err := packetReader.Next()
	if err != nil {
		return nil, err
	}

	key, ok := pkt.(*packet.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("got non-private key from packet reader: %T", pkt)
	}

	if err := key.Decrypt(passphraseB); err != nil {
		return nil, fmt.Errorf("failed to decrypt private key: %w", err)
	}
	return key, nil
}

// signRPMRepo signs an RPM repository using PGP.
// The signature gets written to the file repodata/repomd.xml.asc.
func signRPMRepo(repoRoot string, cfg PublishConfig) error {
	if cfg.GPGPublicKey == "" || cfg.GPGPrivateKey == "" {
		return fmt.Errorf("private or public key is empty")
	}

	log.Printf("Signing RPM repo")

	pubKey, err := getPublicKey(cfg)
	if err != nil {
		return err
	}

	privKey, err := getPrivateKey(cfg)
	if err != nil {
		return err
	}

	pcfg := packet.Config{
		DefaultHash:            crypto.SHA256,
		DefaultCipher:          packet.CipherAES256,
		DefaultCompressionAlgo: packet.CompressionZLIB,
		CompressionConfig: &packet.CompressionConfig{
			Level: 9,
		},
		RSABits: 4096,
	}
	currentTime := pcfg.Now()
	uid := packet.NewUserId("", "", "")

	isPrimaryID := false
	keyLifetimeSecs := uint32(86400 * 365)
	signer := openpgp.Entity{
		PrimaryKey: pubKey,
		PrivateKey: privKey,
		Identities: map[string]*openpgp.Identity{
			uid.Id: {
				Name:   uid.Name,
				UserId: uid,
				SelfSignature: &packet.Signature{
					CreationTime: currentTime,
					SigType:      packet.SigTypePositiveCert,
					PubKeyAlgo:   packet.PubKeyAlgoRSA,
					Hash:         pcfg.Hash(),
					IsPrimaryId:  &isPrimaryID,
					FlagsValid:   true,
					FlagSign:     true,
					FlagCertify:  true,
					IssuerKeyId:  &pubKey.KeyId,
				},
			},
		},
		Subkeys: []openpgp.Subkey{
			{
				PublicKey:  pubKey,
				PrivateKey: privKey,
				Sig: &packet.Signature{
					CreationTime:              currentTime,
					SigType:                   packet.SigTypeSubkeyBinding,
					PubKeyAlgo:                packet.PubKeyAlgoRSA,
					Hash:                      pcfg.Hash(),
					PreferredHash:             []uint8{8}, // SHA-256
					FlagsValid:                true,
					FlagEncryptStorage:        true,
					FlagEncryptCommunications: true,
					IssuerKeyId:               &pubKey.KeyId,
					KeyLifetimeSecs:           &keyLifetimeSecs,
				},
			},
		},
	}

	// Ignore gosec G304 as this function is only used in the build process.
	//nolint:gosec
	freader, err := os.Open(filepath.Join(repoRoot, "repodata", "repomd.xml"))
	if err != nil {
		return err
	}
	defer func(freader *os.File) {
		err := freader.Close()
		if err != nil {
			return
		}
	}(freader)

	// Ignore gosec G304 as this function is only used in the build process.
	//nolint:gosec
	sigwriter, err := os.Create(filepath.Join(repoRoot, "repodata", "repomd.xml.asc"))
	if err != nil {
		return err
	}
	defer func(sigwriter *os.File) {
		err := sigwriter.Close()
		if err != nil {
			return
		}
	}(sigwriter)

	if err := openpgp.ArmoredDetachSignText(sigwriter, &signer, freader, nil); err != nil {
		return fmt.Errorf("failed to write PGP signature: %w", err)
	}

	if err := sigwriter.Close(); err != nil {
		return fmt.Errorf("failed to write PGP signature: %w", err)
	}

	return nil
}
