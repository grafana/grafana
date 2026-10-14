import fs from 'fs';
import path from 'path';

// A JSON file on disk, not process.env: the setup and dependent projects each run in their
// own Playwright worker process, so state has to survive a process boundary, not just outlive
// a single test file.
const MANIFEST_PATH = path.join(__dirname, '.gma-corpus-manifest.json');

export interface CorpusFolder {
  uid: string;
  title: string;
  /** UID of the folder this one is nested under, if any — used to prove folder-path display. */
  parentUid?: string;
  alertRuleUids: string[];
  recordingRuleUids: string[];
}

export interface CorpusManifest {
  /** The unique label value stamped on every rule this run created — read-only browsing tests
   * assert against this, never an organization-wide total. */
  runMarker: string;
  denseFolderUid: string;
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

export function clearCorpusManifest(): void {
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
}
