//@ts-check
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

/**
 * Counts theme token usage (e.g. `theme.colors.text.link`) across the repo with the
 * @grafana/theme-token-usage rule, for the CI code stats scripts.
 *
 * Output in the format:
 * @example
 * theme.spacing 4321
 * theme.colors.text.link 123
 */
function main() {
  /** @type {{ ignorePatterns?: string[] }} */
  const rootConfig = JSON.parse(readFileSync(path.join(repoRoot, '.oxlintrc.json'), 'utf8'));

  // A separate config runs only this rule. Its own ignorePatterns would resolve from scripts/oxlint/,
  // so the root config's ignores are passed on the command line, where they resolve from the repo root.
  const ignoreArgs = (rootConfig.ignorePatterns ?? []).flatMap((pattern) => ['--ignore-pattern', pattern]);

  let output;
  try {
    output = execFileSync(
      path.join(repoRoot, 'node_modules/.bin/oxlint'),
      ['-c', path.join(repoRoot, 'scripts/oxlint/theme-token-usage.json'), ...ignoreArgs, '--format', 'json', '.'],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    );
  } catch (error) {
    // oxlint exits non-zero when it reports errors, which every token usage is.
    output = error.stdout;
  }

  /** @type {Array<{ code?: string, message: string }>} */
  const diagnostics = JSON.parse(output.slice(output.indexOf('{'))).diagnostics;

  /** @type {Record<string, number>} */
  const countByToken = {};
  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== '@grafana(theme-token-usage)') {
      continue;
    }
    countByToken[diagnostic.message] = (countByToken[diagnostic.message] || 0) + 1;
  }

  console.log(
    Object.entries(countByToken)
      .map(([token, count]) => `${token} ${count}`)
      .join('\n')
  );
}

main();
