import { execLine, getPluginVersion } from './execLine';
import { getPluginId } from '../../config/utils/getPluginId';

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

const GHR_VERSION = '0.13.0';
const GHR_ARCH = process.arch === 'x64' ? 'amd64' : '386';
const GHR_PLATFORM = ghrPlatform();
const GHR_EXTENSION = process.platform === 'linux' ? 'tar.gz' : 'zip';

class GitHubRelease {
  token: string;
  username: string;
  circleSha1: string;
  releaseNotes: string;
  constructor(token: string, username: string, circleSha1: string, releaseNotes: string) {
    // Get the ghr binary according to platform
    this.getGhr();
    this.token = token;
    this.username = username;
    this.circleSha1 = circleSha1;
    this.releaseNotes = releaseNotes;
  }

  /**
   * Get the ghr binary to perform the release
   */
  private getGhr() {
    const outName = `./ghr.${GHR_EXTENSION}`;
    const archiveName = `ghr_v${GHR_VERSION}_${GHR_PLATFORM}_${GHR_ARCH}`;
    const ghrUrl = `https://github.com/tcnksm/ghr/releases/download/v${GHR_VERSION}/${archiveName}.${GHR_EXTENSION}`;
    execLine(`wget ${ghrUrl} -o ${outName}`);
    if (GHR_EXTENSION === 'tar.gz') {
      execLine(`tar zxOvf ${outName} ${archiveName}/ghr > ./ghr`);
    } else {
      execLine(`unzip -p ${outName} ${archiveName}/ghr.exe > ./ghr.exe`);
    }
  }

  release() {
    execLine(`ghr
      -t "${this.token}"
      -u "${this.username}"
      -r "${getPluginId()}"
      -c "${this.circleSha1}"
      -n "${getPluginId()}_v${getPluginVersion()}"
      -b "${this.releaseNotes}"
      -delete
      "v${getPluginVersion()}"
      ./artifacts/`);
  }
}

export { GitHubRelease };
