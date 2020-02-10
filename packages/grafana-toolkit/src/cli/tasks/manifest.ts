import { Task, TaskRunner } from './task';
import fs from 'fs';
import path from 'path';

interface ManifestOptions {
  folder: string;
}

function getFileHashes(root: string, name: string, info: string): string {
  if (!info) {
    info = `# Manifest`;
  }

  const files = fs.readdirSync(path.join(root, name));
  files.forEach(file => {
    const abs = path.join(root, file);
    if (fs.statSync(abs).isDirectory()) {
      info = getFileHashes(root, file, info);
    } else {
      const hash = 'xxxx'; // TODO get the file hash
      info += hash + ' ' + file + '\r\n';
    }
  });

  return info;
}

const manifestRunner: TaskRunner<ManifestOptions> = async ({ folder }) => {
  console.log('--------------------------------------------------------------------');
  console.log('Scanning files');
  console.log('--------------------------------------------------------------------');

  const info = getFileHashes(folder, '', '');

  console.log(info);
  console.log('TODO... sign and save it...');
};

export const manifestTask = new Task<ManifestOptions>('Build Manifest', manifestRunner);
