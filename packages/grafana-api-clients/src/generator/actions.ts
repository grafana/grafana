import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/** Write a new file, creating parent directories. Refuses to overwrite. */
export function writeNewFile(filePath: string, content: string) {
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Insert text immediately before a marker line, preserving the marker. */
export function injectBeforeMarker(filePath: string, marker: string, text: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(marker)) {
    throw new Error(`Marker not found in ${filePath}: ${marker}`);
  }
  fs.writeFileSync(filePath, content.replace(marker, text + '\n' + marker), 'utf8');
}

/** Insert text immediately after a marker line, preserving the marker. */
export function injectAfterMarker(filePath: string, marker: string, text: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(marker)) {
    throw new Error(`Marker not found in ${filePath}: ${marker}`);
  }
  fs.writeFileSync(filePath, content.replace(marker, marker + '\n' + text), 'utf8');
}

/** Return the list of files that need formatting after generation. */
export function getFilesToFormat(groupName: string, version: string, isEnterprise: boolean): string[] {
  const apiClientBasePath = isEnterprise
    ? 'public/app/extensions/api/clients'
    : 'packages/grafana-api-clients/src/clients/rtkq';
  const generateScriptPath = isEnterprise
    ? 'local/generate-enterprise-apis.ts'
    : 'packages/grafana-api-clients/src/scripts/generate-rtk-apis.ts';

  return [
    `${apiClientBasePath}/${groupName}/${version}/baseAPI.ts`,
    `${apiClientBasePath}/${groupName}/${version}/index.ts`,
    generateScriptPath,
    ...(isEnterprise
      ? []
      : [
          'packages/grafana-api-clients/src/index.ts',
          'packages/grafana-api-clients/src/clients/rtkq/index.ts',
          'packages/grafana-api-clients/package.json',
        ]),
  ];
}

/** Run ESLint + Prettier on the given files (paths relative to basePath). */
export function formatFiles(basePath: string, files: string[]) {
  const absolute = files.map((f) => `"${path.join(basePath, f)}"`).join(' ');

  console.log('🧹 Running ESLint on generated/modified files...');
  try {
    execSync(`yarn eslint --fix ${absolute}`, { cwd: basePath });
  } catch (e) {
    console.warn(`⚠️ Warning: ESLint encountered issues: ${e instanceof Error ? e.message : e}`);
  }

  console.log('🧹 Running Prettier on generated/modified files...');
  try {
    // --ignore-path so gitignored files (local/) can still be formatted
    execSync(`yarn prettier --write ${absolute} --ignore-path=./.prettierignore`, { cwd: basePath });
  } catch (e) {
    console.warn(`⚠️ Warning: Prettier encountered issues: ${e instanceof Error ? e.message : e}`);
  }
}

/** Run the RTK codegen to produce endpoints.gen.ts. */
export function runGenerateApis(basePath: string, isEnterprise: boolean) {
  const command = isEnterprise
    ? 'yarn workspace @grafana/openapi process-specs && npx rtk-query-codegen-openapi ./local/generate-enterprise-apis.ts'
    : 'yarn workspace @grafana/api-clients generate-apis';

  console.log(`⏳ Running ${command} to generate endpoints...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: basePath });
    console.log('✅ API endpoints generated successfully!');
  } catch (e) {
    console.error(`❌ Failed to generate API endpoints: ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}

/** Add a new package.json export entry for the generated client. */
export function updatePackageJsonExports(basePath: string, groupName: string, version: string) {
  const packageJsonPath = path.join(basePath, 'packages/grafana-api-clients/package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const exportKey = `./rtkq/${groupName}/${version}`;
  if (packageJson.exports[exportKey]) {
    console.log(`✅ Export for ${exportKey} already exists in package.json`);
    return;
  }

  packageJson.exports[exportKey] = {
    '@grafana-app/source': `./src/clients/rtkq/${groupName}/${version}/index.ts`,
    types: `./dist/types/clients/rtkq/${groupName}/${version}/index.d.ts`,
    import: `./dist/esm/clients/rtkq/${groupName}/${version}/index.mjs`,
    require: `./dist/cjs/clients/rtkq/${groupName}/${version}/index.cjs`,
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Added export for ${exportKey} to package.json`);
}

/** List JSON files in the appropriate openapi_snapshots directory. */
export function getOpenAPISpecs(basePath: string, isEnterprise: boolean): string[] {
  const openapiDir = isEnterprise
    ? path.join(basePath, 'pkg/extensions/apiserver/tests/openapi_snapshots')
    : path.join(basePath, 'pkg/tests/apis/openapi_snapshots');

  try {
    return fs.readdirSync(openapiDir).filter((file) => file.endsWith('.json'));
  } catch {
    throw new Error(
      "No OpenAPI specs found! Are you trying to generate an API client for enterprise but haven't linked your local environment?"
    );
  }
}
