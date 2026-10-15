import fs from 'fs';
import path from 'path';

// A JSON file on disk, not process.env: the setup, the Viewer specs and the teardown each run in
// their own Playwright worker process, so state has to survive a process boundary.
const MANIFEST_PATH = path.join(__dirname, '.gma-viewer-fixtures-manifest.json');

export interface ViewerFixtureRule {
  uid: string;
  title: string;
}

export interface ViewerFixtures {
  /** The label value stamped on both rules, used to scope the Viewer's list to them. */
  runMarker: string;
  /** The dedicated Viewer user, created fresh by the setup and deleted by the teardown. */
  viewerUserId: number;
  folderUid: string;
  folderTitle: string;
  alertRule: ViewerFixtureRule;
  recordingRule: ViewerFixtureRule;
}

export function writeViewerFixtures(fixtures: ViewerFixtures): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(fixtures, null, 2));
}

export function readViewerFixtures(): ViewerFixtures | undefined {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

/** A missing manifest means the setup project did not run, which must fail the spec rather than
 * silently skip what depends on it. */
export function requireViewerFixtures(): ViewerFixtures {
  const fixtures = readViewerFixtures();
  if (!fixtures) {
    throw new Error(
      'Viewer fixtures manifest not found. Run this spec with the alerting-viewer project, which depends on alerting-viewer-fixtures-setup.'
    );
  }
  return fixtures;
}

export function clearViewerFixtures(): void {
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
}
