import { execSync } from 'child_process';
import path from 'path';

import { type Variant, PACKAGE_ROOT } from './variants.ts';

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

function runOrWarn(label: string, command: string, cwd: string) {
  console.log(`🧹 Running ${label} on generated/modified files...`);
  try {
    execSync(command, { cwd });
  } catch (e) {
    console.warn(`⚠️ Warning: ${label} encountered issues: ${e instanceof Error ? e.message : e}`);
  }
}

/** Run ESLint + Prettier on the given files (paths relative to basePath). */
export function formatFiles(basePath: string, files: string[]) {
  const absolute = files.map((f) => `"${path.join(basePath, f)}"`).join(' ');
  runOrWarn('ESLint', `pnpm exec eslint --fix ${absolute}`, basePath);
  // --ignore-path so gitignored files (local/) can still be formatted
  runOrWarn('Prettier', `pnpm exec prettier --write ${absolute} --ignore-path=./.prettierignore`, basePath);
}

/** Run the RTK codegen to produce endpoints.gen.ts. */
export function runGenerateApis(basePath: string, variant: Variant) {
  console.log(`⏳ Running ${variant.generateCommand} to generate endpoints...`);
  try {
    execSync(variant.generateCommand, { stdio: 'inherit', cwd: basePath });
    console.log('✅ API endpoints generated successfully!');
  } catch (e) {
    console.error(`❌ Failed to generate API endpoints: ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}
