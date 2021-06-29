// +build ignore

package main

import (
	"bytes"
	"crypto/md5"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"go/build"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	windows = "windows"
	linux   = "linux"
)

var (
	//versionRe = regexp.MustCompile(`-[0-9]{1,3}-g[0-9a-f]{5,10}`)
	goarch    string
	goos      string
	gocc      string
	cgo       bool
	libc      string
	pkgArch   string
	version   string = "v1"
	buildTags []string
	// deb & rpm does not support semver so have to handle their version a little differently
	linuxPackageVersion   string = "v1"
	linuxPackageIteration string = ""
	race                  bool
	workingDir            string
	includeBuildId        bool     = true
	buildId               string   = "0"
	serverBinary          string   = "grafana-server"
	cliBinary             string   = "grafana-cli"
	binaries              []string = []string{serverBinary, cliBinary}
	isDev                 bool     = false
	enterprise            bool     = false
	skipRpmGen            bool     = false
	skipDebGen            bool     = false
	printGenVersion       bool     = false
)

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	var buildIdRaw string
	var buildTagsRaw string

	flag.StringVar(&goarch, "goarch", runtime.GOARCH, "GOARCH")
	flag.StringVar(&goos, "goos", runtime.GOOS, "GOOS")
	flag.StringVar(&gocc, "cc", "", "CC")
	flag.StringVar(&libc, "libc", "", "LIBC")
	flag.StringVar(&buildTagsRaw, "build-tags", "", "Sets custom build tags")
	flag.BoolVar(&cgo, "cgo-enabled", cgo, "Enable cgo")
	flag.StringVar(&pkgArch, "pkg-arch", "", "PKG ARCH")
	flag.BoolVar(&race, "race", race, "Use race detector")
	flag.BoolVar(&includeBuildId, "includeBuildId", includeBuildId, "IncludeBuildId in package name")
	flag.BoolVar(&enterprise, "enterprise", enterprise, "Build enterprise version of Grafana")
	flag.StringVar(&buildIdRaw, "buildId", "0", "Build ID from CI system")
	flag.BoolVar(&isDev, "dev", isDev, "optimal for development, skips certain steps")
	flag.BoolVar(&skipRpmGen, "skipRpm", skipRpmGen, "skip rpm package generation (default: false)")
	flag.BoolVar(&skipDebGen, "skipDeb", skipDebGen, "skip deb package generation (default: false)")
	flag.BoolVar(&printGenVersion, "gen-version", printGenVersion, "generate Grafana version and output (default: false)")
	flag.Parse()

	buildId = shortenBuildId(buildIdRaw)

	readVersionFromPackageJson()

	if pkgArch == "" {
		pkgArch = goarch
	}

	if printGenVersion {
		printGeneratedVersion()
		return
	}

	if len(buildTagsRaw) > 0 {
		buildTags = strings.Split(buildTagsRaw, ",")
	}

	log.Printf("Version: %s, Linux Version: %s, Package Iteration: %s\n", version, linuxPackageVersion, linuxPackageIteration)

	if flag.NArg() == 0 {
		log.Println("Usage: go run build.go build")
		return
	}

	workingDir, _ = os.Getwd()

	for _, cmd := range flag.Args() {
		switch cmd {
		case "setup":
			setup()

		case "build-srv", "build-server":
			clean()
			doBuild("grafana-server", "./pkg/cmd/grafana-server", buildTags)

		case "build-cli":
			clean()
			doBuild("grafana-cli", "./pkg/cmd/grafana-cli", buildTags)

		case "build":
			//clean()
			for _, binary := range binaries {
				doBuild(binary, "./pkg/cmd/"+binary, buildTags)
			}

		case "build-frontend":
			yarn("build")

		case "sha-dist":
			shaFilesInDist()

		case "latest":
			makeLatestDistCopies()

		case "clean":
			clean()

		default:
			log.Fatalf("Unknown command %q", cmd)
		}
	}
}

func makeLatestDistCopies() {
	files, err := ioutil.ReadDir("dist")
	if err != nil {
		log.Fatalf("failed to create latest copies. Cannot read from /dist")
	}

	latestMapping := map[string]string{
		"_amd64.deb":               "dist/grafana_latest_amd64.deb",
		".x86_64.rpm":              "dist/grafana-latest-1.x86_64.rpm",
		".linux-amd64.tar.gz":      "dist/grafana-latest.linux-x64.tar.gz",
		".linux-amd64-musl.tar.gz": "dist/grafana-latest.linux-x64-musl.tar.gz",
		".linux-armv7.tar.gz":      "dist/grafana-latest.linux-armv7.tar.gz",
		".linux-armv7-musl.tar.gz": "dist/grafana-latest.linux-armv7-musl.tar.gz",
		".linux-armv6.tar.gz":      "dist/grafana-latest.linux-armv6.tar.gz",
		".linux-arm64.tar.gz":      "dist/grafana-latest.linux-arm64.tar.gz",
		".linux-arm64-musl.tar.gz": "dist/grafana-latest.linux-arm64-musl.tar.gz",
	}

	for _, file := range files {
		for extension, fullName := range latestMapping {
			if strings.HasSuffix(file.Name(), extension) {
				runError("cp", path.Join("dist", file.Name()), fullName)
			}
		}
	}
}

func readVersionFromPackageJson() {
	reader, err := os.Open("package.json")
	if err != nil {
		log.Fatal("Failed to open package.json")
		return
	}
	defer reader.Close()

	jsonObj := map[string]interface{}{}
	jsonParser := json.NewDecoder(reader)

	if err := jsonParser.Decode(&jsonObj); err != nil {
		log.Fatal("Failed to decode package.json")
	}

	version = jsonObj["version"].(string)
	linuxPackageVersion = version
	linuxPackageIteration = ""

	// handle pre version stuff (deb / rpm does not support semver)
	parts := strings.Split(version, "-")

	if len(parts) > 1 {
		linuxPackageVersion = parts[0]
		linuxPackageIteration = parts[1]
	}

	// add timestamp to iteration
	if includeBuildId {
		if buildId != "0" {
			linuxPackageIteration = fmt.Sprintf("%s%s", buildId, linuxPackageIteration)
		} else {
			linuxPackageIteration = fmt.Sprintf("%d%s", time.Now().Unix(), linuxPackageIteration)
		}
	}
}

func yarn(params ...string) {
	runPrint(`yarn run`, params...)
}

func genPackageVersion() string {
	if includeBuildId {
		return fmt.Sprintf("%v-%v", linuxPackageVersion, linuxPackageIteration)
	} else {
		return version
	}
}

func setup() {
	args := []string{"install", "-v"}
	if goos == windows {
		args = append(args, "-buildmode=exe")
	}
	args = append(args, "./pkg/cmd/grafana-server")
	runPrint("go", args...)
}

func printGeneratedVersion() {
	fmt.Print(genPackageVersion())
}

func test(pkg string) {
	setBuildEnv()
	args := []string{"test", "-short", "-timeout", "60s"}
	if goos == windows {
		args = append(args, "-buildmode=exe")
	}
	args = append(args, pkg)
	runPrint("go", args...)
}

func doBuild(binaryName, pkg string, tags []string) {
	libcPart := ""
	if libc != "" {
		libcPart = fmt.Sprintf("-%s", libc)
	}
	binary := fmt.Sprintf("./bin/%s-%s%s/%s", goos, goarch, libcPart, binaryName)
	if isDev {
		//don't include os/arch/libc in output path in dev environment
		binary = fmt.Sprintf("./bin/%s", binaryName)
	}

	if goos == windows {
		binary += ".exe"
	}

	if !isDev {
		rmr(binary, binary+".md5")
	}
	args := []string{"build", "-ldflags", ldflags()}
	if goos == windows {
		// Work around a linking error on Windows: "export ordinal too large"
		args = append(args, "-buildmode=exe")
	}
	if len(tags) > 0 {
		args = append(args, "-tags", strings.Join(tags, ","))
	}
	if race {
		args = append(args, "-race")
	}

	args = append(args, "-o", binary)
	args = append(args, pkg)

	if !isDev {
		setBuildEnv()
		runPrint("go", "version")
		libcPart := ""
		if libc != "" {
			libcPart = fmt.Sprintf("/%s", libc)
		}
		fmt.Printf("Targeting %s/%s%s\n", goos, goarch, libcPart)
	}

	runPrint("go", args...)

	if !isDev {
		// Create an md5 checksum of the binary, to be included in the archive for
		// automatic upgrades.
		err := md5File(binary)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func ldflags() string {
	var b bytes.Buffer
	b.WriteString("-w")
	b.WriteString(fmt.Sprintf(" -X main.version=%s", version))
	b.WriteString(fmt.Sprintf(" -X main.commit=%s", getGitSha()))
	b.WriteString(fmt.Sprintf(" -X main.buildstamp=%d", buildStamp()))
	b.WriteString(fmt.Sprintf(" -X main.buildBranch=%s", getGitBranch()))
	if v := os.Getenv("LDFLAGS"); v != "" {
		b.WriteString(fmt.Sprintf(" -extldflags \"%s\"", v))
	}
	return b.String()
}

func rmr(paths ...string) {
	for _, path := range paths {
		log.Println("rm -r", path)
		os.RemoveAll(path)
	}
}

func clean() {
	if isDev {
		return
	}

	rmr("dist")
	rmr("tmp")
	rmr(filepath.Join(build.Default.GOPATH, fmt.Sprintf("pkg/%s_%s/github.com/grafana", goos, goarch)))
}

func setBuildEnv() {
	os.Setenv("GOOS", goos)
	if goos == windows {
		// require windows >=7
		os.Setenv("CGO_CFLAGS", "-D_WIN32_WINNT=0x0601")
	}
	if goarch != "amd64" || goos != linux {
		// needed for all other archs
		cgo = true
	}
	if strings.HasPrefix(goarch, "armv") {
		os.Setenv("GOARCH", "arm")
		os.Setenv("GOARM", goarch[4:])
	} else {
		os.Setenv("GOARCH", goarch)
	}
	if cgo {
		os.Setenv("CGO_ENABLED", "1")
	}
	if gocc != "" {
		os.Setenv("CC", gocc)
	}
}

func getGitBranch() string {
	v, err := runError("git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "main"
	}
	return string(v)
}

func getGitSha() string {
	v, err := runError("git", "rev-parse", "--short", "HEAD")
	if err != nil {
		return "unknown-dev"
	}
	return string(v)
}

func buildStamp() int64 {
	// use SOURCE_DATE_EPOCH if set.
	if s, _ := strconv.ParseInt(os.Getenv("SOURCE_DATE_EPOCH"), 10, 64); s > 0 {
		return s
	}

	bs, err := runError("git", "show", "-s", "--format=%ct")
	if err != nil {
		return time.Now().Unix()
	}
	s, _ := strconv.ParseInt(string(bs), 10, 64)
	return s
}

func runError(cmd string, args ...string) ([]byte, error) {
	ecmd := exec.Command(cmd, args...)
	bs, err := ecmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	return bytes.TrimSpace(bs), nil
}

func runPrint(cmd string, args ...string) {
	log.Println(cmd, strings.Join(args, " "))
	ecmd := exec.Command(cmd, args...)
	ecmd.Stdout = os.Stdout
	ecmd.Stderr = os.Stderr
	err := ecmd.Run()
	if err != nil {
		log.Fatal(err)
	}
}

func md5File(file string) error {
	fd, err := os.Open(file)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := md5.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".md5")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

func shaFilesInDist() {
	filepath.Walk("./dist", func(path string, f os.FileInfo, err error) error {
		if path == "./dist" {
			return nil
		}

		if !strings.Contains(path, ".sha256") {
			err := shaFile(path)
			if err != nil {
				log.Printf("Failed to create sha file. error: %v\n", err)
			}
		}
		return nil
	})
}

func shaFile(file string) error {
	fd, err := os.Open(file)
	if err != nil {
		return err
	}
	defer fd.Close()

	h := sha256.New()
	_, err = io.Copy(h, fd)
	if err != nil {
		return err
	}

	out, err := os.Create(file + ".sha256")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintf(out, "%x\n", h.Sum(nil))
	if err != nil {
		return err
	}

	return out.Close()
}

func shortenBuildId(buildId string) string {
	buildId = strings.Replace(buildId, "-", "", -1)
	if len(buildId) < 9 {
		return buildId
	}
	return buildId[0:8]
}
