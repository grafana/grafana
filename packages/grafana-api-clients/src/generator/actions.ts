import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { type Variant, PACKAGE_ROOT } from './variants.ts';

interface ClientGenerationInput {
  groupName: string;
  version: string;
  reducerPath: string;
}

interface PackageJson {
  exports?: Record<string, unknown>;
}

export interface ClientGenerationState {
  hasConfigEntry: boolean;
  hasBaseAPI: boolean;
  hasIndex: boolean;
  hasEndpoint: boolean;
  hasRTKImport: boolean;
  hasRTKReducer: boolean;
  hasRTKMiddleware: boolean;
  hasPackageExport: boolean;
  existingClientFiles: string[];
  missingParts: string[];
  isComplete: boolean;
}

export function writeNewFileIfMissing(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    console.warn(`⚠️ Skipping existing file: ${filePath}`);
    return false;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function clientSubpath(variant: Variant, groupName: string, version: string): string {
  return `${variant.clientBase}/${groupName}/${version}`;
}

function repoPathExists(basePath: string, filePath: string): boolean {
  return fs.existsSync(path.join(basePath, filePath));
}

function fileContains(filePath: string, text: string): boolean {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes(text);
}

function packageExportKey(groupName: string, version: string): string {
  return `./rtkq/${groupName}/${version}`;
}

export function getRTKClientEntries({ groupName, reducerPath, version }: ClientGenerationInput) {
  return {
    importEntry: `import { generatedAPI as ${reducerPath} } from './${groupName}/${version}';`,
    reducerEntry: `  [${reducerPath}.reducerPath]: ${reducerPath}.reducer,`,
    middlewareEntry: `  ${reducerPath}.middleware,`,
  };
}

export function hasAPIConfigEntry(basePath: string, variant: Variant, groupName: string, version: string): boolean {
  const configPath = path.join(basePath, variant.codegenScript);
  const content = fs.readFileSync(configPath, 'utf8');
  const configEntryStart = `createAPIConfig('${groupName}', '${version}'`;

  return content.includes(configEntryStart);
}

export function getExistingClientFiles(
  basePath: string,
  variant: Variant,
  groupName: string,
  version: string
): string[] {
  const subpath = clientSubpath(variant, groupName, version);
  return [`${subpath}/baseAPI.ts`, `${subpath}/index.ts`, `${subpath}/endpoints.gen.ts`].filter((filePath) =>
    repoPathExists(basePath, filePath)
  );
}

export function hasPackageJsonExport(basePath: string, groupName: string, version: string): boolean {
  const packageJsonPath = path.join(basePath, `${PACKAGE_ROOT}/package.json`);
  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  return Boolean(packageJson.exports?.[packageExportKey(groupName, version)]);
}

export function getClientGenerationState(
  basePath: string,
  variant: Variant,
  input: ClientGenerationInput
): ClientGenerationState {
  const subpath = clientSubpath(variant, input.groupName, input.version);
  const baseAPIPath = `${subpath}/baseAPI.ts`;
  const indexPath = `${subpath}/index.ts`;
  const endpointPath = `${subpath}/endpoints.gen.ts`;
  const isPackageClient = variant.clientBase.startsWith(PACKAGE_ROOT);
  const existingClientFiles = getExistingClientFiles(basePath, variant, input.groupName, input.version);
  const hasConfigEntry = hasAPIConfigEntry(basePath, variant, input.groupName, input.version);
  const hasBaseAPI = repoPathExists(basePath, baseAPIPath);
  const hasIndex = repoPathExists(basePath, indexPath);
  const hasEndpoint = repoPathExists(basePath, endpointPath);
  let hasRTKImport = false;
  let hasRTKReducer = false;
  let hasRTKMiddleware = false;
  let hasPackageExport = false;

  if (isPackageClient) {
    const rtkqIndexPath = path.join(basePath, variant.clientBase, 'index.ts');
    const entries = getRTKClientEntries(input);
    hasRTKImport = fileContains(rtkqIndexPath, entries.importEntry);
    hasRTKReducer = fileContains(rtkqIndexPath, entries.reducerEntry);
    hasRTKMiddleware = fileContains(rtkqIndexPath, entries.middlewareEntry);
    hasPackageExport = hasPackageJsonExport(basePath, input.groupName, input.version);
  }

  const missingParts: string[] = [];
  if (!hasConfigEntry) {
    missingParts.push(`${variant.codegenScript} config entry`);
  }
  if (!hasBaseAPI) {
    missingParts.push(baseAPIPath);
  }
  if (!hasIndex) {
    missingParts.push(indexPath);
  }
  if (isPackageClient && !hasRTKImport) {
    missingParts.push(`${variant.clientBase}/index.ts import`);
  }
  if (isPackageClient && !hasRTKReducer) {
    missingParts.push(`${variant.clientBase}/index.ts reducer`);
  }
  if (isPackageClient && !hasRTKMiddleware) {
    missingParts.push(`${variant.clientBase}/index.ts middleware`);
  }
  if (isPackageClient && !hasPackageExport) {
    missingParts.push(`${PACKAGE_ROOT}/package.json export`);
  }

  return {
    hasConfigEntry,
    hasBaseAPI,
    hasIndex,
    hasEndpoint,
    hasRTKImport,
    hasRTKReducer,
    hasRTKMiddleware,
    hasPackageExport,
    existingClientFiles,
    missingParts,
    isComplete: missingParts.length === 0,
  };
}

/** Insert text immediately before a marker line, preserving the marker. */
export function injectBeforeMarkerIfMissing(filePath: string, marker: string, text: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(text)) {
    console.log(`✅ Entry already exists in ${filePath}`);
    return false;
  }
  if (!content.includes(marker)) {
    throw new Error(`Marker not found in ${filePath}: ${marker}`);
  }
  const replacement = `${text}\n${marker}`;
  fs.writeFileSync(filePath, content.replace(marker, replacement), 'utf8');
  return true;
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
  const exportKey = packageExportKey(groupName, version);
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
