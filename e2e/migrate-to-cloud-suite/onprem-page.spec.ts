import { e2e } from '../utils';

const SESSION_UID = 'test-session-uid';
const SNAPSHOT_UID1 = 'test-snapshot-uid';
const SNAPSHOT_UID2 = 'test-snapshot-uid2';

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

describe('Migrate to Cloud (On-prem)', () => {
  it('configures, creates, uploads and then reconfigures a snapshot sucessfully', () => {
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
      body: {
        token: 'test-token',
      },
    }).as('createMigrationToken');

    cy.intercept('GET', '/api/cloudmigration/migration', {
      statusCode: 200,
      body: {
        sessions: [
          {
            uid: SESSION_UID,
            slug: 'test-slug',
            created: '2025-03-27T12:00:00Z',
            updated: '2025-03-27T12:00:00Z',
          },
        ],
      },
    }).as('getMigrationSessionList');

    // Click the connect button to create the token.
    cy.get('[data-testid="migrate-to-cloud-connect-session-modal-connect-button"]').should('be.visible').click();

    // Wait for the token to be created and the migration session list to be fetched to kickstart the UI state machine.
    cy.wait(['@createMigrationToken', '@getMigrationSessionList']);

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

    cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshots**`, {
      statusCode: 200,
      body: {
        snapshots: [
          {
            uid: SNAPSHOT_UID1,
            sessionUid: SESSION_UID,
            status: 'INITIALIZING',
            created: '2025-03-27T12:00:00Z',
            finished: null,
          },
        ],
      },
    }).as('getSnapshotList');

    cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}**`, {
      statusCode: 200,
      body: {
        uid: SNAPSHOT_UID1,
        sessionUid: SESSION_UID,
        status: 'PENDING_UPLOAD',
        created: '2025-03-27T12:00:00Z',
        finished: null,
        results: SNAPSHOT_RESULTS,
      },
    }).as('getSnapshot');

    // Build the snapshot.
    cy.get('[data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"]').should('be.visible').click();

    // Wait for the snapshot to be created. Simulate it going from INITIALIZING to PENDING_UPLOAD.
    cy.wait(['@createSnapshot', '@getSnapshotList', '@getSnapshot']);

    cy.intercept('POST', `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}/upload`, {
      statusCode: 200,
    }).as('uploadSnapshot1');

    // Upload the snapshot.
    cy.get('[data-testid="migrate-to-cloud-summary-upload-snapshot-button"]').should('be.visible').click();

    // Simulate the snapshot being uploaded, the frontend will keep polling until the snapshot is either finished or errored.
    let called = false;

    cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}**`, (req) => {
      req.reply((res) => {
        if (!called) {
          res.send({
            statusCode: 200,
            body: {
              uid: SNAPSHOT_UID1,
              sessionUid: SESSION_UID,
              status: 'UPLOADING',
              created: '2025-03-27T12:00:00Z',
              finished: null,
              results: SNAPSHOT_RESULTS,
            },
          });
          called = true;
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
                types: {},
                statuses: { OK: SNAPSHOT_RESULTS.length },
                total: SNAPSHOT_RESULTS.length,
              },
            },
          });
        }
      });
    }).as('getSnapshotUploading');

    // Wait for the request to kickstart the upload and then wait until it is finished.
    cy.wait(['@uploadSnapshot1', '@getSnapshotUploading']);

    // The upload button should now be hidden away.
    cy.get('[data-testid="migrate-to-cloud-summary-upload-snapshot-button"]').should('be.disabled');

    // We can now reconfigure the snapshot.
    cy.get('[data-testid="migrate-to-cloud-summary-reconfigure-snapshot-button"]').should('be.visible').click();

    // Check the 'Include all' resources checkbox.
    cy.get('[data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-include-all"]')
      .check({ force: true })
      .should('be.checked');

    cy.intercept('POST', `/api/cloudmigration/migration/${SESSION_UID}/snapshot`, {
      statusCode: 200,
      body: {
        uid: SNAPSHOT_UID2,
      },
    }).as('createSnapshotReconfigure');

    cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshots**`, {
      statusCode: 200,
      body: {
        snapshots: [
          {
            uid: SNAPSHOT_UID2,
            sessionUid: SESSION_UID,
            status: 'INITIALIZING',
            created: '2025-04-01T10:00:00Z',
            finished: null,
          },
        ],
      },
    }).as('getSnapshotListReconfigure');

    cy.intercept('GET', `/api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID2}**`, {
      statusCode: 200,
      body: {
        uid: SNAPSHOT_UID2,
        sessionUid: SESSION_UID,
        status: 'PENDING_UPLOAD',
        created: '2025-03-27T12:00:00Z',
        finished: null,
        results: SNAPSHOT_RESULTS,
      },
    }).as('getSnapshotReconfigure');

    // Build the new snapshot.
    cy.get('[data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"]').should('be.visible').click();

    // We have to wait for `@getSnapshotUploading` because the FE will have kept in its state the old snapshot,
    // and will make a request. Once the new snapshot is created, we compare the state with the newly created snapshot,
    // so we can resume the state machine.
    cy.wait([
      '@getSnapshotUploading',
      '@createSnapshotReconfigure',
      '@getSnapshotListReconfigure',
      '@getSnapshotReconfigure',
    ]);

    // Don't upload it again, but we should be able to see these buttons.
    cy.get('[data-testid="migrate-to-cloud-summary-upload-snapshot-button"]').should('be.visible');
    cy.get('[data-testid="migrate-to-cloud-summary-reconfigure-snapshot-button"]').should('be.visible');
  });
});
