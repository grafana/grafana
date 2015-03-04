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
	versionRe  = regexp.MustCompile(`-[0-9]{1,3}-g[0-9a-f]{5,10}`)
	goarch     string
	goos       string
	version    string = "v1"
	race       bool
	workingDir string

	installRoot   = "/opt/grafana"
	configRoot    = "/etc/grafana"
	grafanaLogDir = "/var/log/grafana"
)

const minGoVersion = 1.3

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	ensureGoPath()
	readVersionFromPackageJson()

	log.Printf("Version: %s\n", version)

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
			var tags []string
			clean()
			build(pkg, tags)

		case "test":
			test("./pkg/...")
			grunt("test")

		case "package":
			//verifyGitRepoIsClean()
			grunt("release", "--pkgVer="+version)
			createRpmAndDeb()

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
	runError("cp", "dist/grafana-"+strings.Replace(version, "-", "_", 5)+"-1.x86_64.rpm", "dist/grafana-latest-1.x84_64.rpm")
	runError("cp", "dist/grafana-"+version+".x86_64.tar.gz", "dist/grafana-latest.x84_64.tar.gz")
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
}

func createRpmAndDeb() {
	packageRoot, _ := ioutil.TempDir("", "grafana-linux-pack")
	postInstallScriptPath, _ := ioutil.TempFile("", "postinstall")

	versionFolder := filepath.Join(packageRoot, installRoot, "versions", version)
	configDir := filepath.Join(packageRoot, configRoot)

	runError("mkdir", "-p", versionFolder)
	runError("mkdir", "-p", configDir)

	// copy sample ini file to /etc/opt/grafana
	configFile := filepath.Join(configDir, "grafana.ini")
	runError("cp", "conf/sample.ini", configFile)
	// copy release files
	runError("cp", "-a", filepath.Join(workingDir, "tmp")+"/.", versionFolder)

	GeneratePostInstallScript(postInstallScriptPath.Name())

	args := []string{
		"-s", "dir",
		"--description", "Grafana",
		"-C", packageRoot,
		"--vendor", "Grafana",
		"--url", "http://grafana.org",
		"--license", "Apache 2.0",
		"--maintainer", "contact@grafana.org",
		"--config-files", filepath.Join(configRoot, "grafana.ini"),
		"--after-install", postInstallScriptPath.Name(),
		"--name", "grafana",
		"--version", version,
		"-p", "./dist",
		".",
	}

	fmt.Println("Creating debian package")
	runPrint("fpm", append([]string{"-t", "deb"}, args...)...)

	fmt.Println("Creating redhat/centos package")
	runPrint("fpm", append([]string{"-t", "rpm"}, args...)...)
}

func GeneratePostInstallScript(path string) {
	content := `
rm -f $INSTALL_ROOT_DIR/current
ln -s $INSTALL_ROOT_DIR/versions/$VERSION/ $INSTALL_ROOT_DIR/current

if [ ! -L /etc/init.d/grafana ]; then
    ln -sfn $INSTALL_ROOT_DIR/current/scripts/init.sh /etc/init.d/grafana
fi

chmod +x /etc/init.d/grafana
if which update-rc.d > /dev/null 2>&1 ; then
   update-rc.d -f grafana remove
   update-rc.d grafana defaults
else
   chkconfig --add grafana
fi

if ! id grafana >/dev/null 2>&1; then
   useradd --system -U -M grafana
fi
chown -R -L grafana:grafana $INSTALL_ROOT_DIR
chmod -R a+rX $INSTALL_ROOT_DIR
mkdir -p $GRAFANA_LOG_DIR
chown -R -L grafana:grafana $GRAFANA_LOG_DIR
`
	content = strings.Replace(content, "$INSTALL_ROOT_DIR", installRoot, -1)
	content = strings.Replace(content, "$VERSION", version, -1)
	content = strings.Replace(content, "$GRAFANA_LOG_DIR", grafanaLogDir, -1)
	ioutil.WriteFile(path, []byte(content), 0644)
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
	runPrint("go", "get", "-v", "github.com/mattn/go-sqlite3")
	runPrint("go", "install", "-v", "github.com/mattn/go-sqlite3")
}

func test(pkg string) {
	setBuildEnv()
	runPrint("go", "test", "-short", "-timeout", "60s", pkg)
}

func build(pkg string, tags []string) {
	binary := "./bin/grafana"
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
