import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const projects = JSON.parse(execFileSync('pnpm', ['-r', 'list', '--depth', '-1', '--json'], { encoding: 'utf8' }));
const publishable = projects.filter((project) => !project.private);

if (publishable.length === 0) {
  throw new Error('No publishable workspace packages found');
}

const filters = publishable.flatMap(({ name }) => ['--filter', name]);
const result = spawnSync(
  'pnpm',
  ['-r', ...filters, 'pack', '--pack-destination', join(process.cwd(), 'npm-artifacts')],
  {
    stdio: 'inherit',
  }
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
