import fs from 'fs';
import path from 'path';

// A JSON file on disk, not process.env: the setup and dependent projects each run in their
// own Playwright worker process, so state has to survive a process boundary, not just outlive
// a single test file.
const MANIFEST_PATH = path.join(__dirname, '.gma-corpus-manifest.json');

export interface CorpusRule {
  uid: string;
  title: string;
}

export interface CorpusFolder {
  uid: string;
  title: string;
  /** UID of the folder this one is nested under, if any — used to prove folder-path display. */
  parentUid?: string;
  alertRules: CorpusRule[];
  recordingRules: CorpusRule[];
}

export interface CorpusManifest {
  /** The unique label value stamped on every rule this run created — read-only browsing tests
   * assert against this, never an organization-wide total. */
  runMarker: string;
  /** 80 Alert and 80 Recording rules. */
  denseFolderUid: string;
  /** Holds exactly one Alert rule and no Recording rule. */
  alertOnlyFolderUid: string;
  /** Holds exactly one Recording rule and no Alert rule. */
  recordingOnlyFolderUid: string;
  /** Holds no rules, so the lists never show it. */
  emptyFolderUid: string;
  /** Holds one rule of each kind and sits under another one-of-each folder. */
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

/** For specs that read the corpus: a missing manifest means the setup project did not run, which
 * must fail the run rather than silently skip the specs that depend on it. */
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

/** A top-level folder holding one rule of each kind, which no test changes. */
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
