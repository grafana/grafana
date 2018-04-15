#!/usr/bin/python2.7
"""
TODO :
- makeLatestDistCopies
"""
import argparse
import datetime
import glob
import hashlib
import json
import logging
import os
import pprint
import shutil
import StringIO
import stat
import subprocess
import sys
import tarfile
import tempfile
import zipfile

import requests
import yaml

supportedArch = ['armv7', 'arm64', 'x64', 'osx64', 'win64']
supportedTarget = supportedArch+['all', 'all-linux']

defaultGoenvConfig = """
armv7:
    goos: linux
    goarch: arm
    goarm: 7
    cgo_enabled: 1
    cc: arm-linux-gnueabihf-gcc
arm64:
    goos: linux
    goarch: arm64
    cgo_enabled: 1
    cc: aarch64-linux-gnu-gcc
osx64:
    goos: darwin
    goarch: amd64
    cgo_enabled: 1
    cc: /tmp/osxcross/target/bin/o64-clang
win64:
    goos: windows
    goarch: amd64
    cgo_enabled: 1
    cgo_flags: -D_WIN32_WINNT=0x0601
    cc: x86_64-w64-mingw32-gcc
x64:
    goos: linux
    goarch: amd64
    cgo_enabled: 1
    cc: /tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc
"""

class Config:
    def __init__(self, cross=None, includeBuildNumber=False, buildNumber=None):
        self.includeBuildNumber = includeBuildNumber
        self.buildNumber = buildNumber

        self._verifyGitRepoIsClean()
        self._readVersionFromPackageJson()
        self._getGitSha()
        self._buildStamp()
        self._loadGoEnv(cross)

    def _loadGoEnv(self, cross):
        if not cross:
            cfg = yaml.load(StringIO.StringIO(defaultGoenvConfig))
            logging.info('using default config for crossbuild')
        else:
            with open(cross) as file:
                cfg = yaml.load(file)
            logging.info('using {} file for crossbuild config'.format(cross))

        self.goenv = cfg

        buffer = StringIO.StringIO()
        pp = pprint.PrettyPrinter(stream=buffer)
        pp.pprint(cfg)
        logging.debug('Effective crossbuild config:\n{}'.format(buffer.getvalue()))

    def _readVersionFromPackageJson(self):
        global buildNumber
        with open('package.json') as file:
            p = json.load(file)

        version = p['version']
        packageVersion = version
        packageIteration = ''

        parts = version.split('-')
        if len(parts) > 1:
            packageVersion, packageIteration = parts

        if self.includeBuildNumber:
            if not self.buildNumber:
                self.buildNumber = datetime.datetime.utcnow().strftime('%s')
            packageIteration = '{}{}'.format(self.buildNumber, packageIteration)

        self.version = version
        self.packageVersion = packageVersion
        self.packageIteration = packageIteration

    def _verifyGitRepoIsClean(self):
        r = subprocess.check_output('git ls-files --modified',
                                    stderr=subprocess.STDOUT, shell=True)
        logging.debug(r.strip().replace('\n', ' '))
        """
        if len(r) > 0 :
            logging.error('Git repository has modified files, aborting')
            sys.exit(1)
        """
        logging.info('Git repository is clean')

    def _getGitSha(self):
        r = subprocess.check_output('git rev-parse --short HEAD',
                                    stderr=subprocess.STDOUT, shell=True)
        r = r.strip().replace('\n', ' ')
        if len(r) != 7:
            logging.error('Fail to git commit sha ({})'.format(r))
            sys.exit(1)
        logging.debug(r)
        self.sha = r

    def _buildStamp(self):
        try:
            r = subprocess.check_output('git show -s --format=%ct',
                                        stderr=subprocess.STDOUT, shell=True)
            r = r.strip().replace('\n', ' ')
            logging.debug(r)
        except Exception as e:
            logging.warn('Failed with {}'.format(e))
            r = datetime.datetime.utcnow().strftime('%s')
        self.stamp = r

    def addNative(self):
        r = subprocess.check_output('go version', shell=True)
        goos, goarch = r.strip().split()[-1].split('/')
        r = subprocess.check_output('go env CC', shell=True)
        cc = r.strip()
        self.goenv['native'] = {
            'goos' : goos,
            'goarch' : goarch,
            'cgo_enabled' : 1,
            'cc' : cc
        }
        logging.info('Found {}/{} as native target'.format(goos, goarch))

class Builder:
    def __init__(self, conf, target=None, gopkg='all'):
        for attr in ('version', 'sha', 'stamp'):
            setattr(self, attr, getattr(conf, attr))
        self.target = target
        self.goenv = conf.goenv[target]
        self._env()
        if gopkg == 'all':
            gopkg = ['grafana-cli', 'grafana-server']

        extMap = {'win64':'.exe'}
        ext = extMap.get(target, '')
        binNames = [p+ext for p in gopkg]
        self._binTuples = zip(binNames, gopkg)

    def _env(self):
        logging.debug('using {}'.format(self.goenv))
        self._ldflags = '-w -X main.version={0.version} -X main.commit={0.sha} -X main.buildStamp={0.stamp}'.format(
                        self)
        common = 'CGO_ENABLED={cgo_enabled} CC={cc} GOOS={goos} GOARCH={goarch}'
        prefixMap = {'win64': common+' CGO_FLAGS={cgo_flags}',
                     'armv7': common+' GOARM={goarm}'}
        self._prefix = prefixMap.get(self.target, common).format(**self.goenv)
        self._dest = 'bin/' + (self.target or '')

        logging.debug('using ldflags={}'.format(self._ldflags))
        logging.debug('using prefix={}'.format(self._prefix))
        logging.debug('using dest={}'.format(self._dest))
        r = subprocess.check_output('{} go env'.format(self._prefix), shell=True)
        logging.debug('effective go env\n{} go env:\n{}'.format(self._prefix, r))

    def build(self):
        cmdList = ["{} go build -ldflags '{}'"
                   ' -o {}/{}'
                   ' ./pkg/cmd/{}'
                   .format(self._prefix, self._ldflags,
                           self._dest, b,
                           p)
                    for b, p in self._binTuples]

        for c in cmdList:
            logging.info(c)
            r = subprocess.check_output(c,
                                        stderr=subprocess.STDOUT, shell=True)
            if r:
                logging.error('Go return error ({}) for {}'.format(c))
                sys.exit(1)

class Packager:
    commonTemplate = {
    	'homeDir':                '/usr/share/grafana',
    	'binPath':                '/usr/sbin',
    	'configDir':              '/etc/grafana',
        'etcDefaultPath':         '/etc/{}',
        'etcDefaultFilePath':     '/etc/{}/grafana-server',
    	'initdScriptFilePath':    '/etc/init.d/grafana-server',
    	'systemdServiceFilePath': '/usr/lib/systemd/system/grafana-server.service',
    	'postinstSrc':    'packaging/{}/control/postinst',
    	'initdScriptSrc': 'packaging/{}/init.d/grafana-server',
    	'defaultFileSrc': 'packaging/{}/{}/grafana-server',
    	'systemdFileSrc': 'packaging/{}/systemd/grafana-server.service',
        }
    targetToArch = {
        'armv7': 'armhf',
        'arm64': 'arm64',
        'x64': 'x86_64'
    }
    def __init__(self, conf, target=None, pkg='all'):
        if pkg == 'all':
            pkg = ['deb', 'rpm', 'archive']
        self.pkg = pkg
        for attr in ('version', 'packageVersion', 'packageIteration', 'includeBuildNumber'):
            setattr(self, attr, getattr(conf, attr))
        self.goenv = conf.goenv[target]
        self.target = target
        subprocess.call('mkdir -p dist', shell=True)

    def package(self):
        self._getPhantomjs()
        if self.goenv['goos'] == 'linux':
            for ext in set(['deb','rpm'])&set(self.pkg):
                self._fpm(ext)
        if 'archive' in self.pkg:
            self._archive()

    def _getPhantomjs(self):
        platform = '{goos}-{goarch}'.format(**self.goenv)
        folder = '/tmp/phantomjs/{}'.format(platform)
        if os.path.exists(folder):
            logging.info('Already downloaded phantomjs for {}'.format(platform))
            return
        officialUrl = 'https://bitbucket.org/ariya/phantomjs/downloads/'
        unofficialUrl = 'https://github.com/fg2it/phantomjs-on-raspberry/releases/download/'
        urlMap = {'darwin-amd64': officialUrl+'phantomjs-2.1.1-macosx.zip',
                'windows-amd64': officialUrl+'phantomjs-2.1.1-windows.zip',
                'linux-amd64': officialUrl+'phantomjs-2.1.1-linux-x86_64.tar.bz2',
                'linux-arm': unofficialUrl+'v2.1.1-wheezy-jessie/phantomjs',
                'linux-arm64': unofficialUrl+'v2.1.1-jessie-stretch-arm64/phantomjs'}
        url = urlMap[platform]
        logging.info('Downloading PhantomJS for {}'.format(platform))
        logging.debug('Download from {}'.format(url))
        r = requests.get(url)
        if r.status_code != 200:
            logging.error('Fail downloading phantomjs for {}'.format(platform))
            sys.exit(1)
        phjs = StringIO.StringIO(r.content)

        officialOsMap = {'darwin-amd64': 'macosx', 'windows-amd64': 'windows',
                 'linux-amd64': 'linux-x86_64'}
        exeMap = {'windows-amd64':'.exe'}
        exe = exeMap.get(platform, '')
        if platform in officialOsMap:
            osName = officialOsMap[platform]
            if self.goenv['goos'] == 'linux':
                logging.debug('Unpacking bz2 PhantomJS for {}'.format(platform))
                archive = tarfile.open(fileobj=phjs, mode='r:bz2')
            else:
                logging.debug('Unpacking zip PhantomJS for {}'.format(platform))
                archive = zipfile.ZipFile(phjs)

            archive.extract('phantomjs-2.1.1-{}/bin/phantomjs{}'.format(osName, exe),
                                folder)
            shutil.move('{}/phantomjs-2.1.1-{}/bin/phantomjs{}'.format(folder, osName, exe),
                        '{}/phantomjs{}'.format(folder, exe))
            shutil.rmtree(folder+'/phantomjs-2.1.1-{}'.format(osName))
            archive.close()
        else:
            os.makedirs(folder)
            with open('{}/phantomjs'.format(folder),'wb') as dest:
                dest.write(phjs.read())
        os.chmod('{}/phantomjs{}'.format(folder, exe),
                 stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH )

    def _settings(self, ext, default):
        d = dict(self.commonTemplate)
        if ext == 'rpm':
            default = 'sysconfig'
        else :
            default = 'default'
        for k in ('etcDefaultPath', 'etcDefaultFilePath'):
            d[k] = d[k].format(default)
        for k in ('postinstSrc', 'initdScriptSrc', 'systemdFileSrc'):
            d[k] = d[k].format(ext)
        d['defaultFileSrc'] = d['defaultFileSrc'].format(ext, default)
        d['packageType'] = ext
        return d

    def _rpmSettings(self):
        d = self._settings('rpm', 'sysconfig')
        d['depends'] = ['/sbin/service', 'fontconfig', 'freetype', 'urw-fonts']
        d['other'] = ['--rpm-posttrans', 'packaging/rpm/control/posttrans']
        return d

    def _debSettings(self):
        d = self._settings('deb', 'default')
        d['depends'] = ['adduser', 'libfontconfig']
        d['other'] = ['--deb-no-default-config-files']
        return d

    def _fpm(self, ext):
        if ext == 'deb':
            d = self._debSettings()
        elif ext == 'rpm':
            d = self._rpmSettings()
        else:
            logging.error('Trying to package for unknown type {}'.format(ext))
            sys.exit(1)
        d['depends'] = " ".join(['--depends '+v for v in d['depends']])
        d['other'] = " ".join(d['other'])
        d['packageVersion'] = self.packageVersion
        if self.packageIteration:
            d['packageIteration'] = '--iteration {}'.format(self.packageIteration)
        else:
            d['packageIteration'] = ''
        d['arch'] = self.targetToArch.get(self.target,
                                          self.goenv['goarch'])
        d['packageRoot'] = tempfile.mkdtemp(prefix='grafana-linux-pack-')
        d['packageType'] = ext

        l = [d[k] for k in ['configDir', 'etcDefaultPath']]
        l += ['/etc/init.d', '/usr/lib/systemd/system', '/usr/sbin']
        for folder in l:
            os.makedirs('{}/{}'.format(d['packageRoot'], folder))

        for bin in ('grafana-server', 'grafana-cli'):
            shutil.copy2('bin/{}/{}'.format(self.target, bin),
                         '{}/{}/{}'.format(d['packageRoot'], d['binPath'], bin))

        dest = ['{}/{}'.format(d['packageRoot'], d[k])
                for k in ('initdScriptFilePath', 'etcDefaultFilePath',
                          'systemdServiceFilePath', 'homeDir')]
        orig = [d[k] for k in ('initdScriptSrc', 'defaultFileSrc', 'systemdFileSrc')]
        for x, y in zip(orig, dest[:-1]):
            shutil.copy2(x, y)
        logging.debug("Copying frontend for package")
        shutil.copytree('tmp/', dest[-1], symlinks=True)
        logging.debug("Copying phantomjs for package")
        shutil.copy2('/tmp/phantomjs/{}-{}/phantomjs'
                        .format(self.goenv['goos'], self.goenv['goarch']),
                     '{}/tools/phantomjs/phantomjs'.format(dest[-1]))

        arg = ('-s dir --description Grafana --name grafana -p ./dist'
		       ' -C {packageRoot}'
		       ' --vendor Grafana --url https://grafana.com'
		       ' --license "Apache 2.0" --maintainer contact@grafana.com'
		       ' --config-files {initdScriptFilePath}'
		       ' --config-files {etcDefaultFilePath}'
		       ' --config-files {systemdServiceFilePath}'
		       ' --after-install {postinstSrc}'
		       ' --version {packageVersion}'
               ' -t {packageType}'
               ' -a {arch}'
               ' {packageIteration} {depends} {other}'
               .format(**d))

        logging.info('Packaging for {}/{}'.format(self.target, ext))
        with open('/dev/null', 'w') as null:
            if logging.getLogger().getEffectiveLevel() == logging.WARNING:
                err, out = null, null
            else:
                err, out = subprocess.STDOUT, None
            logging.debug("calling fpm {} .".format(arg))
            r = subprocess.call('fpm {} .'.format(arg),
                                shell=True, stderr=err, stdout=out)
        if r:
            logging.error('fpm return error {}'.format(r))
            sys.exit(1)
        shutil.rmtree(d['packageRoot'])

    def _archive(self):
        archMap = {'win64': 'x64', 'native': self.goenv['goarch']}
        arch = archMap.get(self.target, self.target)

        if self.includeBuildNumber:
            versionString = '{}-{}'.format(self.packageVersion,
                                           self.packageIteration)
        else:
            versionString = self.version
        basename = 'grafana-{}.{}-{}'.format(versionString,
                                             self.goenv['goos'], arch)
        tempdir = tempfile.mkdtemp(prefix='grafana-linux-pack-')
        archiveRoot = '{}/{}'.format(tempdir, basename)

        logging.debug("Copying frontend for archive {}".format(self.target))
        shutil.copytree('tmp/', archiveRoot)

        os.makedirs(archiveRoot+'/bin')
        binaries = ['grafana-server', 'grafana-cli']
        exeMap = {'win64':'.exe'}
        exe = exeMap.get(self.target, '')

        for bin in binaries:
            f = '{}/bin/{}{}'.format(archiveRoot, bin, exe)
            shutil.copy2('bin/{}/{}{}'.format(self.target, bin, exe), f)
            with open(f, 'rb') as data:
                with open(f+'.md5', 'wb') as checksum:
                    checksum.write( hashlib.md5(data.read()).hexdigest() )
        for f in ['LICENSE.md', 'README.md', 'NOTICE.md']:
            shutil.copy2(f, archiveRoot)
        logging.debug("Copying phantomjs for archive {}".format(self.target))
        shutil.copy2('/tmp/phantomjs/{goos}-{goarch}/phantomjs{}'.format(exe, **self.goenv),
                     '{}/tools/phantomjs/phantomjs{}'.format(archiveRoot, exe))

        logging.info('Creating archive for {}'.format(self.target))
        fmtMap = {'win64': 'zip'}
        fmt = fmtMap.get(self.target, 'gztar')
        shutil.make_archive('dist/'+basename, fmt, base_dir=tempdir)
        shutil.rmtree(tempdir)

def clean():
    logging.info('Cleaning go cache, all grafana binaries, frontend and dist')
    subprocess.check_output('go clean -cache',
                             stderr=subprocess.STDOUT, shell=True)
    shutil.rmtree('./dist', ignore_errors=True)
    shutil.rmtree('./tmp', ignore_errors=True)
    shutil.rmtree('./bin', ignore_errors=True)

def setup():
    r = subprocess.check_output('go get -v github.com/golang/dep',
                                 stderr=subprocess.STDOUT, shell=True)
    logging.info('go get')
    logging.debug('\n{}'.format(r))
    r = subprocess.check_output('go install -v ./pkg/cmd/grafana-server',
                                 stderr=subprocess.STDOUT, shell=True)
    logging.info('go install')
    logging.debug('\n{}'.format(r))

def sha256Dist():
    logging.info('Computing sha256 of dist files')
    for f in glob.glob('dist/*[a-z]'):
        with open(f, 'rb') as data:
            with open(f+'.sha256', 'wb') as checksum:
                checksum.write( hashlib.sha256(data.read()).hexdigest() )

def test():
    logging.info('go test')
    r = subprocess.call('go test -short -timeout 60s ./pkg/...',
                        shell=True)
    logging.info('grunt test')
    r = subprocess.call(['node_modules/.bin/grunt', 'test'],
                         shell=True)
    if r:
        logging.error('Failed building frontend (grunt return {})'.format(r))
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Build grafana')
    groupBuild = parser.add_argument_group('Build', 'Select binaries to build')
    groupBuild.add_argument('-b', '--build',
                        help='Build grafana-server and grafana-cli',
                        action='store_true')
    groupBuild.add_argument('--build-srv', help='Build grafana-server binary',
                        action='append_const', const='grafana-server',
                        dest='binary')
    groupBuild.add_argument('--build-cli', help='Build grafana-cli binary',
                        action='append_const', const='grafana-cli',
                        dest='binary')

    groupPackage = parser.add_argument_group('Packages',
                                             'Select packages to build (build frontend ans backend as needed)')
    groupPackage.add_argument('-p', '--package',
                        help='Package binaries and frontend in all supported format\n'
                             ' (deb, rpm, archive depending on target)',
                        action='store_true')
    groupPackage.add_argument('--pkg-rpm', help='Package in rpm',
                        action='append_const', const='rpm', dest='pack')
    groupPackage.add_argument('--pkg-deb', help='Package in deb',
                        action='append_const', const='deb', dest='pack')
    groupPackage.add_argument('--archive',
                        help='Package in archive (zip or tar.gz) depending on target',
                        action='append_const', const='archive', dest='pack')
    groupPackage.add_argument('--skip-frontend', help="Don't build frontend (priority over -r)",
                        action='store_true')

    parser.add_argument('-t', '--target', help='target platform',
                        action='append', choices=supportedTarget)
    parser.add_argument('-r', '--release',
                        help='Release mode (force clean up and complete rebuild)',
                        action='store_true')


    parser.add_argument('-s', '--setup', help='install go dep',
                        action='store_true')
    parser.add_argument('-c', '--clean', help='force clean up',
                        action='store_true')
    parser.add_argument('--test', help='Run test', action='store_true')
    parser.add_argument('-v', '--verbose', help='increase verbosity',
                        action='count',
                        default=0)

    args = parser.parse_args()
    level = [logging.WARNING, logging.INFO, logging.DEBUG][min(args.verbose, 2)]
    log_format = '[%(levelname)s] %(funcName)s: %(message)s'
    logging.basicConfig(level=level,
                        format=log_format)
    logging.debug('cli args: {}'.format(args))

    conf = Config(includeBuildNumber=not args.release)
    logging.info('Version: {}, Linux Version: {}, Package Iteration: {}'
                 .format(conf.version,
                         conf.packageVersion,
                         conf.packageIteration))

    target = set(args.target or ['native'])
    if 'all' in target:
        target = set(supportedArch)
    elif 'all-linux' in target:
        target.remove('all-linux')
        target |= set(['armv7', 'arm64', 'x64'])
    if 'native' in target:
        conf.addNative()
    logging.info('building for {}'.format(target))

    if args.package:
        packages = ['deb', 'rpm', 'archive']
    else:
        packages = args.pack
    if packages:
        args.build=True

    if args.build:
        binaries = ['grafana-server', 'grafana-cli']
    else:
        binaries = args.binary

    if args.release or args.clean:
        clean()

    if args.setup:
        setup()
    if args.test:
        test()

    if not (binaries or packages):
        logging.info('No binary or package to build.')
        sys.exit(0)

    try:
        if binaries:
            for t in target:
                builder = Builder(conf, target=t, gopkg=binaries)
                builder.build()

        if packages:
            if not args.skip_frontend:
                logging.info('Building frontend with grunt prerelease')
                with open('/dev/null','w') as null:
                    if logging.getLogger().getEffectiveLevel() == logging.WARNING:
                        err, out = null, null
                    else:
                        err, out = subprocess.STDOUT, None
                        r = subprocess.call(['node_modules/.bin/grunt', 'prerelease'],
                                            stderr=err, stdout=out)
                        if r:
                            logging.error('Failed building frontend (grunt return {})'.format(r))
                            sys.exit(1)
            logging.info('Packaging {} for {}'.format(packages,target))
            for t in target:
                packager = Packager(conf, target=t, pkg=packages)
                packager.package()

            sha256Dist()
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        import traceback
        traceback.print_tb(exc_traceback)
        logging.error('{} : Failed with {}'.format(exc_type, e))
        sys.exit(1)
