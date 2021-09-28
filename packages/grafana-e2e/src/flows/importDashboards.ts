import { importDashboard, Dashboard } from './importDashboard';
import { e2e } from '../index';

/**
 * Smoke test several dashboard json files from a test directory
 * and validate that all the panels in each import finish loading their queries
 * @param dirPath the path to a directory which contains json files representing dashboards.
 * A note that due this directory must be relative to `node_modules/@grafana/e2e/cypress/plugins`
 * so an example path might be something like `../../../../../cypress/fixtures/testDashboards`
 * @param queryTimeout a number of ms to wait for the imported dashboard to finish loading
 */
export const importDashboards = async (dirPath: string, queryTimeout?: number) => {
  /* 
    Why not just use fs.readDir? 
    Because Cypress runs this file in a (headless) browser, not in node 
    so we don't have access to fs. Fortunately cypress offers a workaround:
    ".task" which lets us run node like readDir in a separate process 
  */
  e2e()
    .task<Dashboard[]>('getJSONFiles', { dirPath })
    .then((jsonFiles) => {
      jsonFiles.forEach((file) => {
        importDashboard(file, queryTimeout || 6000);
      });
    });
};
