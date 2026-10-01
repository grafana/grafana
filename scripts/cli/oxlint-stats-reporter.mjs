//@ts-check
// eslint-disable-next-line lodash/import-scope -- lodash is a cjs module here
import lodash from 'lodash';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { camelCase } = lodash;

const repoRoot = path.resolve(import.meta.dirname, '../..');

/**
 * Rule IDs that are overly verbose and that we want to combine so they report more cleanly
 *
 * i.e. so we can report `reactHooksRulesOfHooks` instead of `reactHookFooIsCalledConditionallyReactHooksMust...`
 */
const rulesToCombine = ['react-hooks/rules-of-hooks', 'react/no-unescaped-entities', 'no-barrel-files/no-barrel-files'];

const legacyChecksToTransform = [
  { messageRegex: /gfFormUsage/i, prefix: 'noGfFormUsage' },
  { messageRegex: /skippingA11Y/i, prefix: 'noSkippingA11YTestsInStories' },
];

/**
 * Prints the rule violations recorded in oxlint-suppressions.json in a format suitable for
 * consuming on our CI code stats scripts
 *
 * Output in the format:
 * @example
 * betterEslint_reactHooksRulesOfHooks 123
 * betterEslint_noBarrelFilesNoBarrelFiles 123
 */
function main() {
  /** @type {Record<string, Record<string, { count: number }>>} */
  const suppressions = JSON.parse(readFileSync(path.join(repoRoot, 'oxlint-suppressions.json'), 'utf8'));

  // oxlint only reads oxlint-suppressions.json from the working directory, so running it from an
  // empty directory reports the suppressed violations too.
  const cwd = mkdtempSync(path.join(tmpdir(), 'oxlint-stats-'));
  let output;
  try {
    output = execFileSync(
      path.join(repoRoot, 'node_modules/.bin/oxlint'),
      [
        '-c',
        path.join(repoRoot, '.oxlintrc.json'),
        '--format',
        'json',
        '--no-error-on-unmatched-pattern',
        repoRoot,
        path.join(repoRoot, 'public/app/extensions'),
      ],
      { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    );
  } catch (error) {
    // oxlint exits non-zero when it reports errors, which is expected here.
    output = error.stdout;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  /** @type {Array<{ code?: string, message: string, filename: string }>} */
  const diagnostics = JSON.parse(output.slice(output.indexOf('{'))).diagnostics;

  /** @type {Record<string, number>} */
  const countByMessage = {};

  for (const diagnostic of diagnostics) {
    const ruleId = diagnostic.code?.replace(/^(.+)\((.+)\)$/, '$1/$2');
    const file = path.relative(repoRoot, diagnostic.filename);
    const suppressedRule = ruleId?.replace(/^eslint\//, '');
    // Only count violations covered by the suppressions file, the same as ESLint's suppressedMessages.
    if (!suppressedRule || !suppressions[file]?.[suppressedRule]) {
      continue;
    }

    const key = rulesToCombine.includes(ruleId) ? camelCase(ruleId) : camelCase(diagnostic.message);
    countByMessage[key] = (countByMessage[key] || 0) + 1;
  }

  const lines = Object.entries(countByMessage).map(([key, value]) => {
    const prefix = legacyChecksToTransform.find((v) => v.messageRegex.test(key))?.prefix || 'betterEslint';
    return `${prefix}_${key} ${value}`;
  });
  console.log(lines.join('\n'));
}

main();
