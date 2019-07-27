import execa = require('execa');
import path = require('path');
import fs = require('fs');

interface ExtensionBytes {
  [key: string]: number;
}

export function getFileSizeReportInFolder(dir: string, info?: ExtensionBytes): ExtensionBytes {
  if (!info) {
    info = {};
  }

  const files = fs.readdirSync(dir);
  if (files) {
    files.forEach(file => {
      const newbase = path.join(dir, file);
      const stat = fs.statSync(newbase);
      if (stat.isDirectory()) {
        getFileSizeReportInFolder(newbase, info);
      } else {
        let ext = '<other>';
        const idx = file.lastIndexOf('.');
        if (idx > 0) {
          ext = file.substring(idx + 1).toLowerCase();
        }
        const current = info![ext] || 0;
        info![ext] = current + stat.size;
      }
    });
  }
  return info;
}

interface ZipFileInfo {
  name: string;
  size: number;
  contents: ExtensionBytes;
  sha1?: string;
  md5?: string;
}

export async function getPackageDetails(zipFile: string, zipSrc: string, writeChecksum = true): Promise<ZipFileInfo> {
  const zipStats = fs.statSync(zipFile);
  if (zipStats.size < 100) {
    throw new Error('Invalid zip file: ' + zipFile);
  }
  const info: ZipFileInfo = {
    name: path.basename(zipFile),
    size: zipStats.size,
    contents: getFileSizeReportInFolder(zipSrc),
  };
  try {
    const exe = await execa('shasum', [zipFile]);
    const idx = exe.stdout.indexOf(' ');
    const sha1 = exe.stdout.substring(0, idx);
    if (writeChecksum) {
      fs.writeFile(zipFile + '.sha1', sha1, err => {});
    }
    info.sha1 = sha1;
  } catch {
    console.warn('Unable to read SHA1 Checksum');
  }
  try {
    const exe = await execa('md5sum', [zipFile]);
    const idx = exe.stdout.indexOf(' ');
    info.md5 = exe.stdout.substring(0, idx);
  } catch {
    console.warn('Unable to read MD5 Checksum');
  }
  return info;
}
