import { spawnSync } from 'child_process';
import path from 'path';

import { type Variant, PACKAGE_ROOT, ALLOWED_GENERATE_COMMANDS, ALLOWED_FORMAT_COMMANDS } from './variants.ts';

/** Return the list of files that need formatting after generation. */
export function getFilesToFormat(variant: Variant, groupName: string, version: string): string[] {
  const subpath = `${groupName}/${version}`;
  return [
    `${variant.clientBase}/${subpath}/baseAPI.ts`,
    `${variant.clientBase}/${subpath}/index.ts`,
    variant.codegenScript,
    ...(variant.clientBase.startsWith(PACKAGE_ROOT)
      ? [`${PACKAGE_ROOT}/src/index.ts`, `${variant.clientBase}/index.ts`, `${PACKAGE_ROOT}/package.json`]
      : []),
  ];
}

/** Executables that are permitted to be spawned by runOrWarn. */
const ALLOWED_FORMAT_EXECUTABLES: readonly string[] = ['yarn'];

function runOrWarn(label: string, cmd: string, args: string[], cwd: string) {
  // Validate the executable against a strict allowlist before anything else.
  // validatedCmd is the allowlist-verified executable; it is used in the
  // spawnSync call below instead of the raw `cmd` parameter so that static
  // analysis tools can confirm no unvalidated input reaches child_process.
  const validatedCmd = ALLOWED_FORMAT_EXECUTABLES.find((allowed) => allowed === cmd);
  if (validatedCmd === undefined) {
    throw new Error(`Refusing to run disallowed executable: "${cmd}"`);
  }

  // Validate the combined command (executable + sub-command flags) against the
  // known-safe prefix allowlist, catching any unexpected sub-command injection.
  const command = [validatedCmd, ...args].join(' ');
  if (!ALLOWED_FORMAT_COMMANDS.some((allowed) => command.startsWith(allowed))) {
    throw new Error(`Refusing to run disallowed format command: "${command}"`);
  }

  // Validate every argument that looks like a file path: it must resolve to a
  // location inside cwd so that crafted paths cannot escape the project root.
  const resolvedCwd = path.resolve(cwd);
  for (const arg of args) {
    // Skip flag arguments (e.g. --fix, --write, --ignore-path=…).
    if (arg.startsWith('-')) {
      continue;
    }
    const resolvedArg = path.resolve(arg);
    if (!resolvedArg.startsWith(resolvedCwd + path.sep) && resolvedArg !== resolvedCwd) {
      throw new Error(`Refusing to pass path outside of working directory: "${arg}"`);
    }
  }

  console.log(`🧹 Running ${label} on generated/modified files...`);
  const result = spawnSync(validatedCmd, args, { cwd, stdio: 'pipe', shell: false });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.toString() ?? `exit code ${result.status}`;
    console.warn(`⚠️ Warning: ${label} encountered issues: ${detail}`);
  }
}

/** Run ESLint + Prettier on the given files (paths relative to basePath). */
export function formatFiles(basePath: string, files: string[]) {
  const absolutePaths = files.map((f) => path.join(basePath, f));
  runOrWarn('ESLint', 'yarn', ['eslint', '--fix', ...absolutePaths], basePath);
  // --ignore-path so gitignored files (local/) can still be formatted
  runOrWarn('Prettier', 'yarn', ['prettier', '--write', ...absolutePaths, '--ignore-path=./.prettierignore'], basePath);
}

/** Run the RTK codegen to produce endpoints.gen.ts. */
export function runGenerateApis(basePath: string, variant: Variant) {
  // Find the matching allowlist entry and use those verified values in the
  // spawnSync call instead of the raw variant fields, so that static analysis
  // tools can confirm no unvalidated input reaches child_process.
  const validatedEntry = ALLOWED_GENERATE_COMMANDS.find(
    ([allowedCmd, ...allowedArgs]) =>
      variant.generateCmd === allowedCmd &&
      variant.generateArgs.length === allowedArgs.length &&
      variant.generateArgs.every((arg, i) => arg === allowedArgs[i])
  );
  if (validatedEntry === undefined) {
    throw new Error(
      `Refusing to run disallowed generate command: "${variant.generateCmd} ${variant.generateArgs.join(' ')}"`
    );
  }
  const [validatedCmd, ...validatedArgs] = validatedEntry;
  console.log(`⏳ Running ${validatedCmd} to generate endpoints...`);
  const result = spawnSync(validatedCmd, validatedArgs, { stdio: 'inherit', cwd: basePath, shell: false });
  if (result.error) {
    console.error(`❌ Failed to generate API endpoints: ${result.error.message}`);
    throw result.error;
  }
  if (result.status !== 0) {
    const err = new Error(`Command exited with code ${result.status}`);
    console.error(`❌ Failed to generate API endpoints: ${err.message}`);
    throw err;
  }
  console.log('✅ API endpoints generated successfully!');
}
