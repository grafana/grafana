import { getPluginId } from '../../config/utils/getPluginId';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { getCiFolder } from '../../plugins/env';
import path = require('path');
// @ts-ignore
import execa = require('execa');

const ghrPlatform = (): string => {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    default:
      return process.platform;
  }
};

class GitHubRelease {
  token: string;
  username: string;
  repository: string;
  releaseNotes: string;
  commitHash?: string;

  constructor(token: string, username: string, repository: string, releaseNotes: string, commitHash?: string) {
    this.token = token;
    this.username = username;
    this.repository = repository;
    this.releaseNotes = releaseNotes;
    this.commitHash = commitHash;
  }

  /**
   * Get the ghr binary to perform the release
   */
  private async getGhr(): Promise<string> {
    const GHR_VERSION = '0.13.0';
    const GHR_ARCH = process.arch === 'x64' ? 'amd64' : '386';
    const GHR_PLATFORM = ghrPlatform();
    const GHR_EXTENSION = process.platform === 'linux' ? 'tar.gz' : 'zip';
    const outName = `./ghr.${GHR_EXTENSION}`;
    const archiveName = `ghr_v${GHR_VERSION}_${GHR_PLATFORM}_${GHR_ARCH}`;
    const exeName = process.platform === 'linux' ? 'ghr' : 'ghr.exe';
    const exeNameFullPath = path.resolve(process.cwd(), archiveName, exeName);
    const ghrUrl = `https://github.com/tcnksm/ghr/releases/download/v${GHR_VERSION}/${archiveName}.${GHR_EXTENSION}`;
    await execa('wget', [ghrUrl, `--output-document=${outName}`]);
    if (GHR_EXTENSION === 'tar.gz') {
      await execa('tar', ['zxvf', outName]);
    } else {
      await execa('unzip', ['-p', outName]);
    }

    if (process.platform === 'linux') {
      await execa('chmod', ['755', exeNameFullPath]);
    }

    return exeNameFullPath;
  }

  async release(recreate: boolean) {
    const ciDir = getCiFolder();
    const distDir = path.resolve(ciDir, 'dist');
    const distContentDir = path.resolve(distDir, getPluginId());
    const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
    const pluginInfo = getPluginJson(pluginJsonFile).info;
    const PUBLISH_DIR = path.resolve(getCiFolder(), 'packages');
    const commitHash = this.commitHash || pluginInfo.build?.hash;

    // Get the ghr binary according to platform
    const ghrExe = await this.getGhr();

    if (!commitHash) {
      throw 'The release plugin was not able to locate a commithash for release. Either build using the ci, or specify the commit hash with --commitHash <value>';
    }

    const args = [
      '-t',
      this.token,
      '-u',
      this.username,
      '-r',
      this.repository, // should override --- may not be the same
      '-c',
      commitHash,
      '-n',
      `${this.repository}_v${pluginInfo.version}`,
      '-b',
      this.releaseNotes,
      `v${pluginInfo.version}`,
      PUBLISH_DIR,
    ];

    if (recreate) {
      args.splice(12, 0, '-recreate');
    }

    const { stdout } = await execa(ghrExe, args);

    console.log(stdout);
  }
}

export { GitHubRelease };
