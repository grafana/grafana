// +build ignore

package main

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

var (
	versionRe = regexp.MustCompile(`-[0-9]{1,3}-g[0-9a-f]{5,10}`)
	goarch    string
	goos      string
	version   string = "v1"
	// deb & rpm does not support semver so have to handle their version a little differently
	linuxPackageVersion   string = "v1"
	linuxPackageIteration string = ""
	race                  bool
	workingDir            string
	serverBinaryName      string = "grafana-server"
)

const minGoVersion = 1.3

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	ensureGoPath()
	readVersionFromPackageJson()

	log.Printf("Version: %s, Linux Version: %s, Package Iteration: %s\n", version, linuxPackageVersion, linuxPackageIteration)

	flag.StringVar(&goarch, "goarch", runtime.GOARCH, "GOARCH")
	flag.StringVar(&goos, "goos", runtime.GOOS, "GOOS")
	flag.BoolVar(&race, "race", race, "Use race detector")
	flag.Parse()

	if flag.NArg() == 0 {
		log.Println("Usage: go run build.go build")
		return
	}

	workingDir, _ = os.Getwd()

	for _, cmd := range flag.Args() {
		switch cmd {
		case "setup":
			setup()

		case "build":
			pkg := "."
			clean()
			build(pkg, []string{})

		case "test":
			test("./pkg/...")
			grunt("test")

		case "package":
			//verifyGitRepoIsClean()
			grunt("release")
			createLinuxPackages()

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
	runError("cp", "dist/grafana_"+version+"_amd64.deb", "dist/grafana_latest_amd64.deb")
	runError("cp", "dist/grafana-"+strings.Replace(version, "-", "_", 5)+"-1.x86_64.rpm", "dist/grafana-latest-1.x86_64.rpm")
	runError("cp", "dist/grafana-"+version+".linux-x64.tar.gz", "dist/grafana-latest.linux-x64.tar.gz")
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
	} else {
		linuxPackageIteration = strconv.FormatInt(time.Now().Unix(), 10)
	}
}

type linuxPackageOptions struct {
	packageType            string
	homeDir                string
	binPath                string
	configDir              string
	configFilePath         string
	etcDefaultPath         string
	etcDefaultFilePath     string
	initdScriptFilePath    string
	upstartFilePath string
	systemdServiceFilePath string
	version string
	iteration string

	postinstSrc    string
	initdScriptSrc string
	upstartScriptSrc string
	defaultFileSrc string
	systemdFileSrc string

	depends []string
}

func createLinuxPackages() {
	// debian wheezy and before
	createPackage(linuxPackageOptions{
		packageType:            "deb",
		homeDir:                "/usr/share/grafana",
		binPath:                "/usr/sbin/grafana-server",
		configDir:              "/etc/grafana",
		configFilePath:         "/etc/grafana/grafana.ini",
		etcDefaultPath:         "/etc/default",
		etcDefaultFilePath:     "/etc/default/grafana-server",
		initdScriptFilePath:    "/etc/init.d/grafana-server",
		version: linuxPackageVersion,
		iteration: linuxPackageIteration,

		postinstSrc:    "packaging/deb/control/postinst",
		initdScriptSrc: "packaging/deb/init.d/grafana-server",
		defaultFileSrc: "packaging/deb/default/grafana-server",

		depends: []string{"adduser", "libfontconfig"},
	})

	ubuntuIteration := linuxPackageIteration
	if ubuntuIteration != "" {
		ubuntuIteration = fmt.Sprintf("%subuntu", ubuntuIteration)
	}
	createPackage(linuxPackageOptions{
		packageType:            "deb",
		homeDir:                "/usr/share/grafana",
		binPath:                "/usr/sbin/grafana-server",
		configDir:              "/etc/grafana",
		configFilePath:         "/etc/grafana/grafana.ini",
		upstartFilePath:    "/etc/init/grafana-server.conf",
		systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",
		version: linuxPackageVersion,
		iteration: ubuntuIteration,

		postinstSrc:    "packaging/deb/control/postinst",
		upstartScriptSrc: "packaging/deb/init/grafana-server.conf",
		systemdFileSrc: "packaging/deb/systemd/grafana-server.service",

		depends: []string{"adduser", "libfontconfig"},
	})

	createPackage(linuxPackageOptions{
		packageType:            "rpm",
		homeDir:                "/usr/share/grafana",
		binPath:                "/usr/sbin/grafana-server",
		configDir:              "/etc/grafana",
		configFilePath:         "/etc/grafana/grafana.ini",
		systemdServiceFilePath: "/usr/lib/systemd/system/grafana-server.service",
		version: linuxPackageVersion,
		iteration: linuxPackageIteration,

		postinstSrc:    "packaging/rpm/control/postinst",
		systemdFileSrc: "packaging/rpm/systemd/grafana-server.service",

		depends: []string{"initscripts", "fontconfig"},
	})
}

func createPackage(options linuxPackageOptions) {
	packageRoot, _ := ioutil.TempDir("", "grafana-linux-pack")

	// create directories
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.homeDir))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, options.configDir))
	runPrint("mkdir", "-p", filepath.Join(packageRoot, "/usr/sbin"))

	// copy binary
	runPrint("cp", "-p", filepath.Join(workingDir, "tmp/bin/"+serverBinaryName), filepath.Join(packageRoot, options.binPath))
	// copy init.d script
	if options.initdScriptSrc != "" {
		runPrint("mkdir", "-p", filepath.Join(packageRoot, "/etc/init.d"))
		runPrint("mkdir", "-p", filepath.Join(packageRoot, options.etcDefaultPath))
		runPrint("cp", "-p", options.initdScriptSrc, filepath.Join(packageRoot, options.initdScriptFilePath))
		runPrint("cp", "-p", options.defaultFileSrc, filepath.Join(packageRoot, options.etcDefaultFilePath))
	}
	if options.upstartScriptSrc != "" {
		runPrint("mkdir", "-p", filepath.Join(packageRoot, "/etc/init"))
		runPrint("cp", "-p", options.upstartScriptSrc, filepath.Join(packageRoot, options.upstartFilePath))
	}
	// copy systemd file
	if options.systemdFileSrc != "" {
		runPrint("mkdir", "-p", filepath.Join(packageRoot, "/usr/lib/systemd/system"))
		runPrint("cp", "-p", options.systemdFileSrc, filepath.Join(packageRoot, options.systemdServiceFilePath))
	}
	// copy release files
	runPrint("cp", "-a", filepath.Join(workingDir, "tmp")+"/.", filepath.Join(packageRoot, options.homeDir))
	// remove bin path
	runPrint("rm", "-rf", filepath.Join(packageRoot, options.homeDir, "bin"))
	// copy sample ini file to /etc/opt/grafana
	runPrint("cp", "conf/sample.ini", filepath.Join(packageRoot, options.configFilePath))

	args := []string{
		"-s", "dir",
		"--description", "Grafana",
		"-C", packageRoot,
		"--vendor", "Grafana",
		"--url", "http://grafana.org",
		"--license", "Apache 2.0",
		"--maintainer", "contact@grafana.org",
		"--config-files", options.configFilePath,
		"--config-files", options.initdScriptFilePath,
		"--config-files", options.etcDefaultFilePath,
		"--config-files", options.systemdServiceFilePath,
		"--config-files", options.upstartFilePath,
		"--after-install", options.postinstSrc,
		"--name", "grafana",
		"--version", linuxPackageVersion,
		"-p", "./dist",
	}

	if linuxPackageIteration != "" {
		args = append(args, "--iteration", linuxPackageIteration)
	}

	// add dependenciesj
	for _, dep := range options.depends {
		args = append(args, "--depends", dep)
	}

	args = append(args, ".")

	fmt.Println("Creating package: ", options.packageType)
	runPrint("fpm", append([]string{"-t", options.packageType}, args...)...)
}

func verifyGitRepoIsClean() {
	rs, err := runError("git", "ls-files", "--modified")
	if err != nil {
		log.Fatalf("Failed to check if git tree was clean, %v, %v\n", string(rs), err)
		return
	}
	count := len(string(rs))
	if count > 0 {
		log.Fatalf("Git repository has modified files, aborting")
	}

	log.Println("Git repository is clean")
}

func ensureGoPath() {
	if os.Getenv("GOPATH") == "" {
		cwd, err := os.Getwd()
		if err != nil {
			log.Fatal(err)
		}
		gopath := filepath.Clean(filepath.Join(cwd, "../../../../"))
		log.Println("GOPATH is", gopath)
		os.Setenv("GOPATH", gopath)
	}
}

func ChangeWorkingDir(dir string) {
	os.Chdir(dir)
}

func grunt(params ...string) {
	runPrint("./node_modules/grunt-cli/bin/grunt", params...)
}

func setup() {
	runPrint("go", "get", "-v", "github.com/tools/godep")
	runPrint("go", "get", "-v", "github.com/blang/semver")
	runPrint("go", "get", "-v", "github.com/mattn/go-sqlite3")
	runPrint("go", "install", "-v", "github.com/mattn/go-sqlite3")
}

func test(pkg string) {
	setBuildEnv()
	runPrint("go", "test", "-short", "-timeout", "60s", pkg)
}

func build(pkg string, tags []string) {
	binary := "./bin/" + serverBinaryName
	if goos == "windows" {
		binary += ".exe"
	}

	rmr(binary, binary+".md5")
	args := []string{"build", "-ldflags", ldflags()}
	if len(tags) > 0 {
		args = append(args, "-tags", strings.Join(tags, ","))
	}
	if race {
		args = append(args, "-race")
	}

	args = append(args, "-o", binary)
	args = append(args, pkg)
	setBuildEnv()
	runPrint("go", args...)

	// Create an md5 checksum of the binary, to be included in the archive for
	// automatic upgrades.
	err := md5File(binary)
	if err != nil {
		log.Fatal(err)
	}
}

func ldflags() string {
	var b bytes.Buffer
	b.WriteString("-w")
	b.WriteString(fmt.Sprintf(" -X main.version '%s'", version))
	b.WriteString(fmt.Sprintf(" -X main.commit '%s'", getGitSha()))
	b.WriteString(fmt.Sprintf(" -X main.buildstamp %d", buildStamp()))
	return b.String()
}

func rmr(paths ...string) {
	for _, path := range paths {
		log.Println("rm -r", path)
		os.RemoveAll(path)
	}
}

func clean() {
	rmr("bin", "Godeps/_workspace/pkg", "Godeps/_workspace/bin")
	rmr("dist")
	rmr("tmp")
	rmr(filepath.Join(os.Getenv("GOPATH"), fmt.Sprintf("pkg/%s_%s/github.com/grafana", goos, goarch)))
}

func setBuildEnv() {
	os.Setenv("GOOS", goos)
	if strings.HasPrefix(goarch, "armv") {
		os.Setenv("GOARCH", "arm")
		os.Setenv("GOARM", goarch[4:])
	} else {
		os.Setenv("GOARCH", goarch)
	}
	if goarch == "386" {
		os.Setenv("GO386", "387")
	}
	wd, err := os.Getwd()
	if err != nil {
		log.Println("Warning: can't determine current dir:", err)
		log.Println("Build might not work as expected")
	}
	os.Setenv("GOPATH", fmt.Sprintf("%s%c%s", filepath.Join(wd, "Godeps", "_workspace"), os.PathListSeparator, os.Getenv("GOPATH")))
	log.Println("GOPATH=" + os.Getenv("GOPATH"))
}

func getGitSha() string {
	v, err := runError("git", "describe", "--always", "--dirty")
	if err != nil {
		return "unknown-dev"
	}
	v = versionRe.ReplaceAllFunc(v, func(s []byte) []byte {
		s[0] = '+'
		return s
	})
	return string(v)
}

func buildStamp() int64 {
	bs, err := runError("git", "show", "-s", "--format=%ct")
	if err != nil {
		return time.Now().Unix()
	}
	s, _ := strconv.ParseInt(string(bs), 10, 64)
	return s
}

func buildArch() string {
	os := goos
	if os == "darwin" {
		os = "macosx"
	}
	return fmt.Sprintf("%s-%s", os, goarch)
}

func run(cmd string, args ...string) []byte {
	bs, err := runError(cmd, args...)
	if err != nil {
		log.Println(cmd, strings.Join(args, " "))
		log.Println(string(bs))
		log.Fatal(err)
	}
	return bytes.TrimSpace(bs)
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
