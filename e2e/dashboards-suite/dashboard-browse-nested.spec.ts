import { e2e } from '@grafana/e2e';

import { makeNewDashboardRequestBody } from './utils/makeDashboard';

const NUM_ROOT_FOLDERS = 60;
const NUM_ROOT_DASHBOARDS = 60;
const NUM_NESTED_FOLDERS = 60;
const NUM_NESTED_DASHBOARDS = 60;

describe('Dashboard browse (nested)', () => {
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
    // Clean up dashboards
    for (const dashboardUID of dashboardUIDsToCleanUp) {
      e2e.flows.deleteDashboard({
        uid: dashboardUID,
        quick: true,
        title: '',
      });
    }
    // Clean up folders
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
  });
});
