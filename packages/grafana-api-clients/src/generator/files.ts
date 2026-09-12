import fs from 'fs';
import path from 'path';

import { getRTKClientEntries, type TemplateInput } from './templates.ts';
import { MARKERS, PACKAGE_ROOT, type Variant } from './variants.ts';

export function writeNewFileIfMissing(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    console.warn(`⚠️ Skipping existing file: ${filePath}`);
    return false;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

export function repoPathExists(basePath: string, filePath: string): boolean {
  return fs.existsSync(path.join(basePath, filePath));
}

export function fileContains(filePath: string, text: string): boolean {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes(text);
}

export function registerRTKClient(
  basePath: string,
  variant: Variant,
  input: Pick<TemplateInput, 'groupName' | 'version' | 'reducerPath'>
): void {
  if (!variant.clientBase.startsWith(PACKAGE_ROOT)) {
    return;
  }

  const entries = getRTKClientEntries(input);
  for (const [fileName, importEntry] of [
    ['index.ts', entries.importEntry],
    ['registration.ts', entries.baseImportEntry],
  ]) {
    const filePath = path.join(basePath, variant.clientBase, fileName);
    injectBeforeMarkerIfMissing(filePath, MARKERS.IMPORT, importEntry);
    injectBeforeMarkerIfMissing(filePath, MARKERS.REDUCER, entries.reducerEntry);
    injectBeforeMarkerIfMissing(filePath, MARKERS.MIDDLEWARE, entries.middlewareEntry);
  }
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
