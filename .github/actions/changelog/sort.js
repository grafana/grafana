import fs from 'node:fs';
import { semverCompare, semverParse } from './semver.js';

const changelogPath = process.argv[2] ?? 'CHANGELOG.md';

function parseChangelog(content) {
  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? [];
  const blocks = [];
  const buffer = { version: '', parsed: null, content: '' };
  let prefix = '';
  let suffix = '';

  for (const line of lines) {
    const match = line.match(/^<!--\s+(.+)\s+(START|END)\s+-->\r?\n?$/);

    if (match?.[2] === 'START') {
      if (buffer.version) {
        throw new Error(
          `Found a START marker for version ${match[1]} before a matching END marker for version ${buffer.version}`
        );
      }

      const parsed = semverParse(match[1]);
      if (!parsed) {
        throw new Error(`Found a START marker for version ${match[1]} which is not a valid semver version`);
      }

      buffer.version = match[1];
      buffer.parsed = parsed;
      buffer.content = line;
      continue;
    }

    if (match?.[2] === 'END') {
      if (!buffer.version) {
        throw new Error(`Found an END marker for version ${match[1]} without a matching START marker`);
      }

      if (buffer.version !== match[1]) {
        throw new Error(
          `Found an END marker for version ${match[1]} before a matching END marker for version ${buffer.version}`
        );
      }

      buffer.content += line;
      blocks.push({ ...buffer });
      buffer.version = '';
      buffer.parsed = null;
      buffer.content = '';
      continue;
    }

    if (buffer.version) {
      buffer.content += line;
    } else {
      if (!blocks.length) {
        prefix += line;
      } else {
        suffix += line;
      }
    }
  }

  if (buffer.version) {
    throw new Error(`Found a START marker for version ${buffer.version} without a matching END marker`);
  }

  return { prefix, blocks, suffix };
}

if (!fs.existsSync(changelogPath)) {
  process.stderr.write(`Changelog file not found: ${changelogPath}\n`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const { prefix, blocks, suffix } = parseChangelog(content);
  const sorted = blocks
    .sort((left, right) => semverCompare(left.parsed, right.parsed))
    .map((block) => block.content)
    .join('');
  fs.writeFileSync(changelogPath, `${prefix}${sorted}${suffix}`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
