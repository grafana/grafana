import fs from 'fs';
import path from 'path';

// JSON file: setup, specs and teardown run in separate processes.
const MANIFEST_PATH = path.join(__dirname, '.gma-viewer-fixtures-manifest.json');

export interface ViewerFixtureRule {
  uid: string;
  title: string;
}

export interface ViewerFixtures {
  runMarker: string;
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

/** Missing manifest fails the spec rather than skipping. */
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
