/// @ts-check

import { spawn } from 'child_process';

// Runs an i18n extraction pass and fails the build if the extractor reported an error.
//
// i18next-cli logs extraction errors — a nesting conflict that drops a key, a <Trans> child that
// won't match at runtime — and still exits 0. A dropped key never reaches the catalog, so
// extraction produces no diff either and the i18n-verify job passes while the string goes missing
// at runtime. The i18next-parser setup this replaced failed the build via `failOnWarnings: true`,
// dropped in #112512 with no equivalent: no i18next-cli option makes these fatal, because
// `warnOnConflicts` only covers duplicate keys with differing default values.
//
// This is a stopgap. Matching output is the integration upstream points at — it prefixes these
// messages with "Error:" so build tooling can treat them as fatal — but it is still a coupling to
// their output format, so scripts/tests/i18nExtractGuard.test.ts exercises it against the real
// extractor. Delete this in favour of a config option if i18next-cli ever grows one.

const ERROR_LINE = /^[ \t]*Error:.*$/gm;

// i18next-cli colours some output even when piped, and `FORCE_COLOR` makes that unconditional.
// Strip escape sequences before matching so a coloured error can't slip past the anchor.
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/cli/runI18nExtract.mjs <command> [...args]');
  process.exit(1);
}

const commandLine = [command, ...args].join(' ');

// Piping extraction into something that exits early (`| head`, quitting `less`) closes our
// output mid-write. Ignore the EPIPE rather than dying with an unhandled error, which would
// look like a fault in this guard.
/** @param {NodeJS.ErrnoException} err */
const ignoreEpipe = (err) => {
  if (err.code !== 'EPIPE') {
    throw err;
  }
};

process.stdout.on('error', ignoreEpipe);
process.stderr.on('error', ignoreEpipe);

let output = '';
let spawnFailed = false;

const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });

// Stream through untouched so the extractor's own output still reaches the terminal, keeping a
// copy to scan at the end — scanning per chunk would miss a message split across chunks.
child.stdout?.on('data', (chunk) => {
  output += chunk.toString();
  process.stdout.write(chunk);
});

child.stderr?.on('data', (chunk) => {
  output += chunk.toString();
  process.stderr.write(chunk);
});

child.on('error', (err) => {
  spawnFailed = true;
  console.error(`Failed to run "${commandLine}": ${err.message}`);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  // A failed spawn also emits 'close' with the errno as the code; keep the code set above.
  if (spawnFailed) {
    return;
  }

  // Never mask a real failure from the underlying command.
  if (signal) {
    console.error(`"${commandLine}" was terminated by signal ${signal}`);
    process.exitCode = 1;
    return;
  }

  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }

  // Conflicts are reported once per locale, so dedupe.
  const plainOutput = output.replace(ANSI_ESCAPE, '');
  const errors = [...new Set(Array.from(plainOutput.match(ERROR_LINE) ?? [], (line) => line.trim()))];

  if (errors.length === 0) {
    return;
  }

  console.error(`\nExtraction reported ${errors.length} error(s) but exited 0:\n`);
  for (const error of errors) {
    console.error(`  ${error}`);
  }
  console.error(
    `\nThese produce no catalog diff, so nothing else will catch them. Fix them at the source.\nCommand: ${commandLine}\n`
  );

  // Set exitCode rather than calling process.exit() so buffered output is flushed.
  process.exitCode = 1;
});
