import { execFileSync } from 'node:child_process';

function countPackages(recursive) {
  const output = execFileSync(
    'yarn',
    ['info', '**', '--all', ...(recursive ? ['--recursive'] : []), '--name-only', '--json'],
    {
      encoding: 'utf8',
    }
  );
  let count = 0;
  for (const line of output.trim().split('\n')) {
    if (!/@(workspace|link):/.test(JSON.parse(line))) {
      count++;
    }
  }
  return count;
}

console.log(`${countPackages(false)} ${countPackages(true)}`);
