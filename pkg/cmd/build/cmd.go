package build

import (
	"bytes"
	"flag"
	"fmt"
	"go/build"
	"io/ioutil"
	"log"
	"os"
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
	goarch string
	goos   string
	gocc   string
	cgo    bool
	libc   string

	pkgArch   string
	version   string = "v1"
	buildTags []string
	// deb & rpm does not support semver so have to handle their version a little differently
	race            bool
	includeBuildID  bool     = true
	buildID         string   = "0"
	serverBinary    string   = "grafana-server"
	cliBinary       string   = "grafana-cli"
	binaries        []string = []string{serverBinary, cliBinary}
	isDev           bool     = false
	enterprise      bool     = false
	skipRpmGen      bool     = false
	skipDebGen      bool     = false
	printGenVersion bool     = false
)

func logError(message string, err error) int {
	log.Println(message, err)

	return 1
}

// RunCmd runs the build command and returns the exit code
func RunCmd() int {
	var buildIDRaw string
	var buildTagsRaw string

	flag.StringVar(&goarch, "goarch", runtime.GOARCH, "GOARCH")
	flag.StringVar(&goos, "goos", runtime.GOOS, "GOOS")
	flag.StringVar(&gocc, "cc", "", "CC")
	flag.StringVar(&libc, "libc", "", "LIBC")
	flag.StringVar(&buildTagsRaw, "build-tags", "", "Sets custom build tags")
	flag.BoolVar(&cgo, "cgo-enabled", cgo, "Enable cgo")
	flag.StringVar(&pkgArch, "pkg-arch", "", "PKG ARCH")
	flag.BoolVar(&race, "race", race, "Use race detector")
	flag.BoolVar(&includeBuildID, "includeBuildID", includeBuildID, "IncludeBuildID in package name")
	flag.BoolVar(&enterprise, "enterprise", enterprise, "Build enterprise version of Grafana")
	flag.StringVar(&buildIDRaw, "buildID", "0", "Build ID from CI system")
	flag.BoolVar(&isDev, "dev", isDev, "optimal for development, skips certain steps")
	flag.BoolVar(&skipRpmGen, "skipRpm", skipRpmGen, "skip rpm package generation (default: false)")
	flag.BoolVar(&skipDebGen, "skipDeb", skipDebGen, "skip deb package generation (default: false)")
	flag.BoolVar(&printGenVersion, "gen-version", printGenVersion, "generate Grafana version and output (default: false)")
	flag.Parse()

	wd, err := os.Getwd()
	if err != nil {
		log.Println("Error getting working directory", err)
		return 1
	}

	buildID = shortenBuildID(buildIDRaw)

	packageJSON, err := OpenPackageJSON(wd)
	if err != nil {
		return logError("Error opening package json", err)
	}

	version, iteration := LinuxPackageVersion(packageJSON.Version, buildID)
	if pkgArch == "" {
		pkgArch = goarch
	}

	if printGenVersion {
		fmt.Print(genPackageVersion(version, iteration))
		return 0
	}

	if len(buildTagsRaw) > 0 {
		buildTags = strings.Split(buildTagsRaw, ",")
	}

	log.Printf("Version: %s, Linux Version: %s, Package Iteration: %s\n", version, version, iteration)

	if flag.NArg() == 0 {
		log.Println("Usage: go run build.go build")
		return 1
	}

	for _, cmd := range flag.Args() {
		switch cmd {
		case "setup":
			setup()

		case "build-srv", "build-server":
			if !isDev {
				clean()
			}

			doBuild("grafana-server", "./pkg/cmd/grafana-server", buildTags)

		case "build-cli":
			clean()
			doBuild("grafana-cli", "./pkg/cmd/grafana-cli", buildTags)

		case "build":
			//clean()
			for _, binary := range binaries {
				// Can't use filepath.Join here because filepath.Join calls filepath.Clean, which removes the `./` from this path, which upsets `go build`
				doBuild(binary, fmt.Sprintf("./pkg/cmd/%s", binary), buildTags)
			}

		case "build-frontend":
			yarn("build")

		case "sha-dist":
			shaDir("dist")

		case "latest":
			makeLatestDistCopies()

		case "clean":
			clean()

		default:
			log.Println("Unknown command", cmd)
			return 1
		}
	}

	return 0
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

func yarn(params ...string) {
	runPrint(`yarn run`, params...)
}

func genPackageVersion(version string, iteration string) string {
	if iteration != "" {
		return fmt.Sprintf("%v-%v", version, iteration)
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

func clean() {
	rmr("dist")
	rmr("tmp")
	rmr(filepath.Join(build.Default.GOPATH, fmt.Sprintf("pkg/%s_%s/github.com/grafana", goos, goarch)))
}
