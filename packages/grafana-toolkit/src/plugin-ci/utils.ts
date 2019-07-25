import execa from 'execa';
import path from 'path';
import fs from 'fs';
import { PluginDevInfo, ExtensionSize, ZipFileInfo, PluginBuildReport, PluginHistory } from './types';

const md5File = require('md5-file');

export function getFileSizeReportInFolder(dir: string, info?: ExtensionSize): ExtensionSize {
  const acc: ExtensionSize = info ? info : {};

  const files = fs.readdirSync(dir);
  if (files) {
    files.forEach(file => {
      const newbase = path.join(dir, file);
      const stat = fs.statSync(newbase);
      if (stat.isDirectory()) {
        getFileSizeReportInFolder(newbase, info);
      } else {
        let ext = '_none_';
        const idx = file.lastIndexOf('.');
        if (idx > 0) {
          ext = file.substring(idx + 1).toLowerCase();
        }
        const current = acc[ext];
        if (current) {
          current.count += 1;
          current.bytes += stat.size;
        } else {
          acc[ext] = { bytes: stat.size, count: 1 };
        }
      }
    });
  }
  return acc;
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
    info.md5 = md5File.sync(zipFile);
  } catch {
    console.warn('Unable to read MD5 Checksum');
  }
  return info;
}

export function findImagesInFolder(dir: string, prefix = '', append?: string[]): string[] {
  const imgs = append || [];

  const files = fs.readdirSync(dir);
  if (files) {
    files.forEach(file => {
      if (file.endsWith('.png')) {
        imgs.push(file);
      }
    });
  }

  return imgs;
}

export function appendPluginHistory(report: PluginBuildReport, info: PluginDevInfo, history: PluginHistory) {
  history.last = {
    info,
    report,
  };

  if (!history.size) {
    history.size = [];
  }

  console.log('TODO, append build stats to the last one');
}
