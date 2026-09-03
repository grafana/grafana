import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function parseBundleSizes(contents) {
  const sizes = new Map();

  for (const line of contents.trim().split('\n')) {
    const match = /^(\S+) (\d+)$/.exec(line.trim());
    if (!match) {
      throw new Error(`Invalid bundle size stat: ${line}`);
    }

    sizes.set(match[1], Number(match[2]));
  }

  return sizes;
}

export function compareBundleSizes(base, current, maxIncrease) {
  const names = new Set([...base.keys(), ...current.keys()]);

  return [...names].sort().map((name) => {
    const baseSize = base.get(name) ?? 0;
    const currentSize = current.get(name) ?? 0;
    const change = currentSize - baseSize;

    return { name, baseSize, currentSize, change, tooLarge: change > maxIncrease };
  });
}

export function formatBundleSizeReport(comparisons, maxIncrease) {
  const lines = [
    '## Bundle size impact',
    '',
    `The maximum allowed increase for any entrypoint asset group is ${formatBytes(maxIncrease)}.`,
    '',
    '| Asset group | Base | PR | Change | Result |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  for (const comparison of comparisons) {
    lines.push(
      `| \`${comparison.name}\` | ${formatBytes(comparison.baseSize)} | ${formatBytes(comparison.currentSize)} | ${formatSignedBytes(comparison.change)} | ${comparison.tooLarge ? 'Too large' : 'OK'} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatSignedBytes(bytes) {
  const sign = bytes > 0 ? '+' : '';
  return `${sign}${formatBytes(bytes)}`;
}

async function main() {
  // Usage: checkBundleSize.mjs <base-stats> <current-stats> <max-increase-bytes>
  const [basePath, currentPath, maxIncreaseArgument] = process.argv.slice(2);
  const maxIncrease = Number(maxIncreaseArgument);

  const comparisons = compareBundleSizes(
    parseBundleSizes(await readFile(basePath, 'utf8')),
    parseBundleSizes(await readFile(currentPath, 'utf8')),
    maxIncrease
  );

  process.stdout.write(formatBundleSizeReport(comparisons, maxIncrease));

  const failures = comparisons.filter(({ tooLarge }) => tooLarge);
  if (failures.length > 0) {
    process.stderr.write(`Bundle size limit exceeded by: ${failures.map(({ name }) => name).join(', ')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
