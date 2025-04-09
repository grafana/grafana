import { e2e } from '../utils';

describe('Migrate to Cloud (On-prem)', () => {
  // Here we are mostly testing the UI flow and can do interesting things with the backend responses to see how the UI behaves.
  describe('with mocked calls to the API backend', () => {
    afterEach(() => {
      cy.get('[data-testid="migrate-to-cloud-summary-disconnect-button"]').should('be.visible').click();
    });

    const SESSION_UID = 'fehq6hqd246iox';
    const SNAPSHOT_UID1 = 'cehq6vdjqbqbkx';

    const SNAPSHOT_RESULTS = [
      { name: 'FolderA', type: 'FOLDER', refId: 'ref-id-folder-a', parentName: 'General' },
      { name: 'FolderB', type: 'FOLDER', refId: 'ref-id-folder-b', parentName: 'General' },
      { name: 'Prometheus', type: 'DATASOURCE', refId: 'prometheus' },
      { name: 'Postgres', type: 'DATASOURCE', refId: 'postgres' },
      { name: 'Loki', type: 'DATASOURCE', refId: 'loki' },
      { name: 'Alert Rule A', type: 'ALERT_RULE', refId: 'alert-rule-a', parentName: 'FolderA' },
      { name: 'Alert Rule B', type: 'ALERT_RULE', refId: 'alert-rule-b', parentName: 'FolderB' },
      { name: 'Alert Rule C', type: 'ALERT_RULE', refId: 'alert-rule-c', parentName: 'FolderB' },
      { name: 'Alert Rule Group A', type: 'ALERT_RULE_GROUP', refId: 'alert-rule-group-a', parentName: 'FolderA' },
      { name: 'Alert Rule Group B', type: 'ALERT_RULE_GROUP', refId: 'alert-rule-group-b', parentName: 'FolderB' },
      { name: 'Contact Point A', type: 'CONTACT_POINT', refId: 'contact-point-a' },
      { name: 'Contact Point B', type: 'CONTACT_POINT', refId: 'contact-point-b' },
      { name: 'Contact Point C', type: 'CONTACT_POINT', refId: 'contact-point-c' },
      { name: 'Notification Policy A', type: 'NOTIFICATION_POLICY', refId: 'notification-policy-a' },
      { name: 'Notification Template A', type: 'NOTIFICATION_TEMPLATE', refId: 'notification-template-a' },
      { name: 'Notification Template B', type: 'NOTIFICATION_TEMPLATE', refId: 'notification-template-b' },
      { name: 'Notification Template C', type: 'NOTIFICATION_TEMPLATE', refId: 'notification-template-c' },
      { name: 'Plugin A', type: 'PLUGIN', refId: 'plugin-a' },
      { name: 'Plugin B', type: 'PLUGIN', refId: 'plugin-b' },
      { name: 'Plugin C', type: 'PLUGIN', refId: 'plugin-c' },
      { name: 'Mute Timing A', type: 'MUTE_TIMING', refId: 'mute-timing-a' },
      { name: 'Mute Timing B', type: 'MUTE_TIMING', refId: 'mute-timing-b' },
    ];

    const MIGRATION_SESSION = {
      uid: SESSION_UID,
      slug: 'test-slug',
      created: '2025-04-02T21:36:08+02:00',
      updated: '2025-04-02T21:36:08+02:00',
    };

    const STATS = {
      types: SNAPSHOT_RESULTS.reduce(
        (acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      statuses: {
        PENDING: SNAPSHOT_RESULTS.length,
      },
      total: SNAPSHOT_RESULTS.length,
    };

    it('creates and uploads a snapshot sucessfully', () => {
      // Login using the UI.
      e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

      // Visit the migrate to cloud onprem page.
      e2e.pages.MigrateToCloud.visit();

      // Open the connect modal and enter the token.
      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-button"]').should('be.visible').click();

      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-token-input"]')
        .should('be.visible')
        .focus()
        .type('test');

      cy.intercept('POST', '/api/cloudmigration/migration', {
        statusCode: 200,
        body: MIGRATION_SESSION,
      }).as('createMigrationToken');

      cy.intercept('GET', '/api/cloudmigration/migration', {
        statusCode: 200,
        body: {
          sessions: [MIGRATION_SESSION],
        },
      }).as('getMigrationSessionList');

      cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, {
        statusCode: 200,
        body: {
          snapshots: [],
        },
      }).as('getSnapshotListInitial');

      // Click the connect button to create the token.
      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-connect-button"]').should('be.visible').click();

      // Wait for the token to be created and the migration session list to be fetched to kickstart the UI state machine.
      cy.wait(['@createMigrationToken', '@getMigrationSessionList', '@getSnapshotListInitial']);

      // Check the 'Include all' resources checkbox.
      cy.get('[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-include-all"]')
        .check({ force: true })
        .should('be.checked');

      // And validate that all resources are indeed checked.
      for (const resourceType of [
        'alert_rule',
        'alert_rule_group',
        'contact_point',
        'dashboard',
        'datasource',
        'folder',
        'library_element',
        'mute_timing',
        'notification_policy',
        'notification_template',
        'plugin',
      ]) {
        cy.get(
          `[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}"]`
        ).should('be.checked');
      }

      // Remove one of the resources that has dependencies.
      // Mute Timings are dependencies of Alert Rules, which are dependencies of Alert Rule Groups.
      cy.get(`[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-mute_timing"]`)
        .uncheck({ force: true })
        .should('not.be.checked');

      // Validate that those resources are now unchecked.
      for (const resourceType of ['alert_rule', 'alert_rule_group', 'include-all']) {
        cy.get(
          `[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}"]`
        ).should('not.be.checked');
      }

      // Check everything again because we can.
      cy.get('[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-include-all"]')
        .check({ force: true })
        .should('be.checked');

      // Validate that those resources are now checked again.
      for (const resourceType of ['alert_rule', 'alert_rule_group', 'mute_timing']) {
        cy.get(
          `[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}"]`
        ).should('be.checked');
      }

      cy.intercept('POST', `/api/cloudmigration/migration/${SESSION_UID}/snapshot`, {
        statusCode: 200,
        body: {
          uid: SNAPSHOT_UID1,
        },
      }).as('createSnapshot');

      cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, {
        statusCode: 200,
        body: {
          snapshots: [
            {
              uid: SNAPSHOT_UID1,
              sessionUid: SESSION_UID,
              status: 'CREATING',
              created: '2025-04-02T21:40:23+02:00',
              finished: '0001-01-01T00:00:00Z',
            },
          ],
        },
      }).as('getSnapshotListCreating');

      let getSnapshotCalled = false;
      cy.intercept(
        'GET',
        `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}?resultPage=1&resultLimit=50*`,
        (req) => {
          if (!getSnapshotCalled) {
            getSnapshotCalled = true;
            req.reply((res) => {
              res.send({
                statusCode: 200,
                body: {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'CREATING',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                  results: [],
                  stats: {
                    types: {},
                    statuses: {},
                    total: 0,
                  },
                },
              });
            });
          } else {
            req.reply((res) => {
              res.send({
                statusCode: 200,
                body: {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'PENDING_UPLOAD',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'PENDING' })),
                  stats: STATS,
                },
              });
            });
          }
        }
      ).as('getSnapshot');

      // Build the snapshot.
      cy.get('[data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"]').should('be.visible').click();

      // Wait for the snapshot to be created. Simulate it going from INITIALIZING to PENDING_UPLOAD.
      cy.wait(['@createSnapshot', '@getSnapshotListCreating', '@getSnapshot']);

      cy.intercept('POST', `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}/upload`, {
        statusCode: 200,
      }).as('uploadSnapshot');

      // Upload the snapshot.
      cy.get('[data-testid="migrate-to-cloud-summary-upload-snapshot-button"]')
        .should('be.visible')
        .wait(2000)
        .focus()
        .trigger('click', { force: true, waitForAnimations: true });

      cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, {
        statusCode: 200,
        body: {
          snapshots: [
            {
              uid: SNAPSHOT_UID1,
              sessionUid: SESSION_UID,
              status: 'UPLOADING',
              created: '2025-04-02T21:40:23+02:00',
              finished: '0001-01-01T00:00:00Z',
            },
          ],
        },
      }).as('getSnapshotListUploading');

      // Simulate the snapshot being uploaded, the frontend will keep polling until the snapshot is either finished or errored.
      let getSnapshotUploadingCalls = 0;
      cy.intercept(
        'GET',
        `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}?resultPage=1&resultLimit=50*`,
        (req) => {
          req.reply((res) => {
            if (getSnapshotUploadingCalls <= 1) {
              res.send({
                statusCode: 200,
                body: {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: getSnapshotUploadingCalls === 1 ? 'PROCESSING' : 'UPLOADING',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'PENDING' })),
                  stats: STATS,
                },
              });
              getSnapshotUploadingCalls++;
            } else {
              res.send({
                statusCode: 200,
                body: {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'FINISHED',
                  created: '2025-03-27T12:00:00Z',
                  finished: '2025-03-27T12:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'OK' })),
                  stats: {
                    types: STATS.types,
                    statuses: SNAPSHOT_RESULTS.reduce(
                      (acc, r) => {
                        const status = (r as { status?: string }).status || 'UNKNOWN';
                        acc[status] = (acc[status] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>
                    ),
                    total: SNAPSHOT_RESULTS.length,
                  },
                },
              });
            }
          });
        }
      ).as('getSnapshotUploading');

      // Wait for the request to kickstart the upload and then wait until it is finished.
      cy.wait(['@uploadSnapshot', '@getSnapshotListUploading', '@getSnapshotUploading']);

      // At least some of the items are marked with "Uploaded to cloud" status.
      cy.contains('Uploaded to cloud').should('be.visible');

      // We can now reconfigure the snapshot.
      cy.get('[data-testid="migrate-to-cloud-summary-reconfigure-snapshot-button"]').should('be.visible').click();

      // Check the 'Include all' resources checkbox.
      cy.get('[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-include-all"]')
        .check({ force: true })
        .should('be.checked');
    });
  });

  // Here we are doing a more black box testing of the migration flow, without explicitly mocking the API calls,
  // but we instead rely on the `[cloud_migration] developer_mode = true` to be set in the `custom.ini` file,
  // which will make the service use in-memory fake implementations of 3rdparty dependencies, but we'll still
  // use the real API endpoints, database and business logic.
  describe('with a fake GMS backend implementation', () => {
    afterEach(() => {
      cy.get('[data-testid="migrate-to-cloud-summary-disconnect-button"]').should('be.visible').click();
    });

    // Manually crafted base64 token for testing, does not contain any sensitive data.
    const TEST_TOKEN =
      'eyJUb2tlbiI6ImdsY19kZXZfZXlKdklqb2lNVEl6TkNJc0ltNGlPaUpuY21GbVlXNWhMV05zYjNWa0xXMXBaM0poZEdsdmJuTXRNVEl6TkNJc0ltc2lPaUowWlhOMElpd2liU0k2ZXlKeUlqb2laR1YyTFhWekxXTmxiblJ5WVd3aWZYMEsiLCJJbnN0YW5jZSI6eyJTdGFja0lEIjoxMjM0LCJTbHVnIjoidGVzdC1zbHVnIiwiUmVnaW9uU2x1ZyI6ImRldi11cy1jZW50cmFsIiwiQ2x1c3RlclNsdWciOiJkZXYtdXMtY2VudHJhbC0wIn19Cg==';

    it('creates a snapshot sucessfully', () => {
      // Login using the UI.
      e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

      // Visit the migrate to cloud onprem page.
      e2e.pages.MigrateToCloud.visit();

      // Open the connect modal and enter the token.
      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-button"]').should('be.visible').click();

      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-token-input"]')
        .should('be.visible')
        .focus()
        .type(TEST_TOKEN);

      // Click the connect button to create the token.
      cy.get('[data-testid="migrate-to-cloud-connect-session-modal-connect-button"]').should('be.visible').click();

      // Build the snapshot.
      cy.get('[data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"]').should('be.visible').click();

      // And the rebuild button should be visible.
      cy.get('[data-testid="migrate-to-cloud-summary-reconfigure-snapshot-button"]').should('be.visible');

      // We don't upload the snapshot yet because we need to create a mock server to validate the uploaded items,
      // similarly to what the SMTP (tester) server does.
    });
  });
});
