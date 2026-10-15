import fs from 'fs';
import path from 'path';

// JSON file, not process.env: projects run in separate worker processes.
const MANIFEST_PATH = path.join(__dirname, '.gma-corpus-manifest.json');

export interface CorpusRule {
  uid: string;
  title: string;
}

export interface CorpusFolder {
  uid: string;
  title: string;
  parentUid?: string;
  alertRules: CorpusRule[];
  recordingRules: CorpusRule[];
}

export interface CorpusManifest {
  /** Run-unique label on every rule. */
  runMarker: string;
  denseFolderUid: string;
  alertOnlyFolderUid: string;
  recordingOnlyFolderUid: string;
  /** Holds no rules, so the lists never show it. */
  emptyFolderUid: string;
  nestedFolderUid: string;
  folders: CorpusFolder[];
  setupDurationMs: number;
}

export function writeCorpusManifest(manifest: CorpusManifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function readCorpusManifest(): CorpusManifest | undefined {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

/** Missing manifest fails the run rather than skipping specs. */
export function requireCorpusManifest(): CorpusManifest {
  const manifest = readCorpusManifest();
  if (!manifest) {
    throw new Error(
      'Corpus manifest not found. Run this spec with the alerting-corpus-setup project as a dependency (alerting-corpus-tests).'
    );
  }
  return manifest;
}

export function getCorpusFolder(manifest: CorpusManifest, uid: string): CorpusFolder {
  const folder = manifest.folders.find((f) => f.uid === uid);
  if (!folder) {
    throw new Error(`Folder ${uid} is not in the corpus manifest`);
  }
  return folder;
}

export function getPlainCorpusFolder(manifest: CorpusManifest): CorpusFolder {
  const folder = manifest.folders.find(
    (f) => f.alertRules.length === 1 && f.recordingRules.length === 1 && f.parentUid === undefined
  );
  if (!folder) {
    throw new Error('The corpus has no top-level folder with one rule of each kind');
  }
  return folder;
}

export function clearCorpusManifest(): void {
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
}
