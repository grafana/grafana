import fs from 'fs';
import path from 'path';

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
