import { Task, TaskRunner } from './task';
import fs from 'fs';
import path from 'path';
import execa from 'execa';

interface ManifestOptions {
  folder: string;
}

export function getFilePaths(root: string, work?: string, acc?: string[]): string[] {
  if (!acc) {
    acc = [];
  }
  let abs = work ?? root;
  const files = fs.readdirSync(abs);
  files.forEach(file => {
    const f = path.join(abs, file);
    const stat = fs.statSync(f);
    if (stat.isDirectory()) {
      acc = getFilePaths(root, f, acc);
    } else {
      acc!.push(f.substring(root.length + 1).replace('\\', '/'));
    }
  });
  return acc;
}

const manifestRunner: TaskRunner<ManifestOptions> = async ({ folder }) => {
  const filename = 'MANIFEST.txt';
  const files = getFilePaths(folder).filter(f => f !== filename);

  const originalDir = __dirname;
  process.chdir(folder);
  const out = await execa('sha1sum', files);

  // Write the process output
  fs.writeFileSync(path.join(folder, filename), out.stdout);

  // TODO:
  // gpg --output doc.sig --sign doc

  // Go back to where you were
  process.chdir(originalDir);
  console.log('Wrote manifest: ', filename);
};

export const manifestTask = new Task<ManifestOptions>('Build Manifest', manifestRunner);
