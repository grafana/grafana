import { readdirSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const args = process.argv.slice(2);

if (args.length !== 2) {
  throw new Error('expected dev dashboards dir and the output file path');
}

const devDashboardsDir = args[0];
const outputFilePath = args[1];

const getFiles = (dirPath: string, ext?: string): string[] =>
  readdirSync(dirPath, { withFileTypes: true })
    .flatMap((dirEntry) => {
      const res = resolve(dirPath, dirEntry.name);
      return dirEntry.isDirectory() ? getFiles(res) : res;
    })
    .filter((path) => (ext?.length ? path.endsWith(ext) : true));

const files = getFiles(devDashboardsDir, '.json');

mkdirSync(dirname(outputFilePath), { recursive: true });
writeFileSync(outputFilePath, JSON.stringify(files, null, 2));
