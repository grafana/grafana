import path from 'path';

import { fileContains, repoPathExists } from './files.ts';
import { hasPackageJsonExport } from './packageExports.ts';
import { getRTKClientEntries } from './templates.ts';
import { type Variant, PACKAGE_ROOT } from './variants.ts';

interface ClientGenerationInput {
  groupName: string;
  version: string;
  reducerPath: string;
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

function clientSubpath(variant: Variant, groupName: string, version: string): string {
  return `${variant.clientBase}/${groupName}/${version}`;
}

export function hasAPIConfigEntry(basePath: string, variant: Variant, groupName: string, version: string): boolean {
  const configPath = path.join(basePath, variant.codegenScript);
  return fileContains(configPath, `createAPIConfig('${groupName}', '${version}'`);
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
