import { e2e } from '@grafana/e2e';
import { selectors } from '@grafana/e2e-selectors';

import { makeNewDashboardRequestBody } from './utils/makeDashboard';

const NUM_ROOT_FOLDERS = 60;
const NUM_ROOT_DASHBOARDS = 60;
const NUM_NESTED_FOLDERS = 60;
const NUM_NESTED_DASHBOARDS = 60;

// TODO enable this test when nested folders goes live
describe.skip('Dashboard browse (nested)', () => {
  const dashboardUIDsToCleanUp: string[] = [];
  const folderUIDsToCleanUp: string[] = [];

  // Add nested folder structure
  before(() => {
    e2e.flows.login('admin', 'admin');

    // Add root folders
    for (let i = 0; i < NUM_ROOT_FOLDERS; i++) {
      e2e()
        .request({
          method: 'POST',
          url: '/api/folders',
          body: {
            title: `Root folder ${i.toString().padStart(2, '0')}`,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .then((response) => {
          folderUIDsToCleanUp.push(response.body.uid);
        });
    }

    // Add root dashboards
    for (let i = 0; i < NUM_ROOT_DASHBOARDS; i++) {
      e2e()
        .request({
          method: 'POST',
          url: '/api/dashboards/db',
          body: makeNewDashboardRequestBody(`Root dashboard ${i.toString().padStart(2, '0')}`),
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .then((response) => {
          dashboardUIDsToCleanUp.push(response.body.uid);
        });
    }

    // Add folder with children
    e2e()
      .request({
        method: 'POST',
        url: '/api/folders',
        body: {
          title: 'A root folder with children',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then((response) => {
        const folderUid = response.body.uid;
        folderUIDsToCleanUp.push(folderUid);
        // Add nested folders
        for (let i = 0; i < NUM_NESTED_FOLDERS; i++) {
          e2e().request({
            method: 'POST',
            url: '/api/folders',
            body: {
              title: `Nested folder ${i.toString().padStart(2, '0')}`,
              parentUid: folderUid,
            },
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
        // Add nested dashboards
        for (let i = 0; i < NUM_NESTED_DASHBOARDS; i++) {
          e2e().request({
            method: 'POST',
            url: '/api/dashboards/db',
            body: makeNewDashboardRequestBody(`Nested dashboard ${i.toString().padStart(2, '0')}`, folderUid),
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
      });
  });

  // Remove nested folder structure
  after(() => {
    // Clean up root dashboards
    for (const dashboardUID of dashboardUIDsToCleanUp) {
      e2e.flows.deleteDashboard({
        uid: dashboardUID,
        quick: true,
        title: '',
      });
    }
    // Clean up root folders (cascading delete will remove any nested folders and dashboards)
    for (const folderUID of folderUIDsToCleanUp) {
      e2e().request({
        method: 'DELETE',
        url: `/api/folders/${folderUID}`,
        qs: {
          forceDeleteRules: false,
        },
      });
    }
  });

  it('pagination works correctly for folders and root', () => {
    e2e.pages.Dashboards.visit();

    e2e().contains('A root folder with children').should('be.visible');

    // Expand A root folder with children
    e2e().get('[aria-label="Expand folder A root folder with children"]').click();
    e2e().contains('Nested folder 00').should('be.visible');

    // Scroll the page and check visibility of next set of items
    e2e().get(`[data-testid="${selectors.pages.BrowseDashboards.table.body}"] > div`).scrollTo(0, 1700);
    e2e().contains('Nested folder 59').should('be.visible');
    e2e().contains('Nested dashboard 00').should('be.visible');

    // Scroll the page and check visibility of next set of items
    e2e().get(`[data-testid="${selectors.pages.BrowseDashboards.table.body}"] > div`).scrollTo(0, 3800);
    e2e().contains('Nested dashboard 59').should('be.visible');
    e2e().contains('Root folder 00').should('be.visible');

    // Scroll the page and check visibility of next set of items
    e2e().get(`[data-testid="${selectors.pages.BrowseDashboards.table.body}"] > div`).scrollTo(0, 5900);
    e2e().contains('Root folder 59').should('be.visible');
    e2e().contains('Root dashboard 00').should('be.visible');

    // Scroll the page and check visibility of next set of items
    e2e().get(`[data-testid="${selectors.pages.BrowseDashboards.table.body}"] > div`).scrollTo(0, 8000);
    e2e().contains('Root dashboard 59').should('be.visible');
  });
});
