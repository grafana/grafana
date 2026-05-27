import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { type Variant, PACKAGE_ROOT } from './variants.ts';

/** Write a new file, creating parent directories. Refuses to overwrite. */
export function writeNewFile(filePath: string, content: string) {
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Insert text at a marker line, preserving the marker. */
function injectAtMarker(filePath: string, marker: string, text: string, position: 'before' | 'after') {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(marker)) {
    throw new Error(`Marker not found in ${filePath}: ${marker}`);
  }
  const replacement = position === 'before' ? `${text}\n${marker}` : `${marker}\n${text}`;
  fs.writeFileSync(filePath, content.replace(marker, replacement), 'utf8');
}

/** Insert text immediately before a marker line, preserving the marker. */
export function injectBeforeMarker(filePath: string, marker: string, text: string) {
  injectAtMarker(filePath, marker, text, 'before');
}

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
  runOrWarn('ESLint', `yarn eslint --fix ${absolute}`, basePath);
  // --ignore-path so gitignored files (local/) can still be formatted
  runOrWarn('Prettier', `yarn prettier --write ${absolute} --ignore-path=./.prettierignore`, basePath);
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

/** Add a new package.json export entry for the generated client. */
export function updatePackageJsonExports(basePath: string, groupName: string, version: string) {
  const packageJsonPath = path.join(basePath, `${PACKAGE_ROOT}/package.json`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const subpath = `${groupName}/${version}`;
  const exportKey = `./rtkq/${subpath}`;
  if (packageJson.exports[exportKey]) {
    console.log(`✅ Export for ${exportKey} already exists in package.json`);
    return;
  }

  packageJson.exports[exportKey] = {
    '@grafana-app/source': `./src/clients/rtkq/${subpath}/index.ts`,
    types: `./dist/types/clients/rtkq/${subpath}/index.d.ts`,
    import: `./dist/esm/clients/rtkq/${subpath}/index.mjs`,
    require: `./dist/cjs/clients/rtkq/${subpath}/index.cjs`,
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Added export for ${exportKey} to package.json`);
}

/** List JSON files in the appropriate openapi_snapshots directory. */
export function getOpenAPISpecs(basePath: string, variant: Variant): string[] {
  const openapiDir = path.join(basePath, variant.openapiSnapshots);

  try {
    return fs.readdirSync(openapiDir).filter((file) => file.endsWith('.json'));
  } catch {
    throw new Error(
      "No OpenAPI specs found! Are you trying to generate an API client for enterprise but haven't linked your local environment?"
    );
  }
}
