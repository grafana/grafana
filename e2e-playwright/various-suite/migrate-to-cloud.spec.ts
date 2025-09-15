import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Migrate to Cloud (On-prem)',
  {
    tag: ['@various'],
  },
  () => {
    test.describe('with mocked calls to the API backend', () => {
      test.afterEach(async ({ page }) => {
        const disconnectButton = page.getByTestId('migrate-to-cloud-summary-disconnect-button');
        await expect(disconnectButton).toBeVisible();
        await disconnectButton.click();
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
        types: SNAPSHOT_RESULTS.reduce<Record<string, number>>((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {}),
        statuses: {
          PENDING: SNAPSHOT_RESULTS.length,
        },
        total: SNAPSHOT_RESULTS.length,
      };

      test('creates and uploads a snapshot successfully', async ({ page }) => {
        // Visit the migrate to cloud onprem page
        await page.goto('/admin/migrate-to-cloud');

        // Open the connect modal and enter the token
        const connectButton = page.getByTestId('migrate-to-cloud-connect-session-modal-button');
        await expect(connectButton).toBeVisible();
        await connectButton.click();

        const tokenInput = page.getByTestId('migrate-to-cloud-connect-session-modal-token-input');
        await expect(tokenInput).toBeVisible();
        await tokenInput.focus();
        await tokenInput.fill('test');

        // Mock API responses
        await page.route(/api\/cloudmigration\/migration$/, async (route) => {
          if (route.request().method() === 'POST') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(MIGRATION_SESSION),
            });
          } else if (route.request().method() === 'GET') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                sessions: [MIGRATION_SESSION],
              }),
            });
          }
        });

        await page.route(`api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              snapshots: [],
            }),
          });
        });

        // Click the connect button to create the token
        const connectSessionButton = page.getByTestId('migrate-to-cloud-connect-session-modal-connect-button');
        await expect(connectSessionButton).toBeVisible();
        await connectSessionButton.click();

        // Check the 'Include all' resources checkbox
        const includeAllCheckbox = page.getByTestId(
          'migrate-to-cloud-configure-snapshot-checkbox-resource-include-all'
        );
        await includeAllCheckbox.check({ force: true });
        await expect(includeAllCheckbox).toBeChecked();

        // And validate that all resources are indeed checked
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
          const checkbox = page.getByTestId(
            `migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}`
          );
          await expect(checkbox).toBeChecked();
        }

        // Remove one of the resources that has dependencies
        // Mute Timings are dependencies of Alert Rules, which are dependencies of Alert Rule Groups
        const muteTimingCheckbox = page.getByTestId(
          'migrate-to-cloud-configure-snapshot-checkbox-resource-mute_timing'
        );
        await muteTimingCheckbox.uncheck({ force: true });
        await expect(muteTimingCheckbox).toBeChecked({ checked: false });

        // Validate that those resources are now unchecked
        for (const resourceType of ['alert_rule', 'alert_rule_group', 'include-all']) {
          const checkbox = page.getByTestId(
            `migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}`
          );
          await expect(checkbox).toBeChecked({ checked: false });
        }

        // Check everything again because we can
        await includeAllCheckbox.check({ force: true });
        await expect(includeAllCheckbox).toBeChecked();

        // Validate that those resources are now checked again
        for (const resourceType of ['alert_rule', 'alert_rule_group', 'mute_timing']) {
          const checkbox = page.getByTestId(
            `migrate-to-cloud-configure-snapshot-checkbox-resource-${resourceType.toLowerCase()}`
          );
          await expect(checkbox).toBeChecked();
        }

        // Mock snapshot creation
        await page.route(new RegExp(`api\/cloudmigration\/migration\/${SESSION_UID}\/snapshot$`), async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              uid: SNAPSHOT_UID1,
            }),
          });
        });

        await page.route(`api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              snapshots: [
                {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'CREATING',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                },
              ],
            }),
          });
        });

        let getSnapshotCalled = false;
        await page.route(
          `api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}?resultPage=1&resultLimit=50*`,
          async (route) => {
            if (!getSnapshotCalled) {
              getSnapshotCalled = true;
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
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
                }),
              });
            } else {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'PENDING_UPLOAD',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'PENDING' })),
                  stats: STATS,
                }),
              });
            }
          }
        );

        // Build the snapshot
        const buildSnapshotButton = page.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button');
        await expect(buildSnapshotButton).toBeVisible();
        await buildSnapshotButton.click();

        const uploadButton = page.getByTestId('migrate-to-cloud-summary-upload-snapshot-button');
        await expect(uploadButton).toBeVisible();

        // Mock upload
        await page.route(
          `api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}/upload`,
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true }),
            });
          }
        );

        // Mock uploading status
        await page.route(`api/cloudmigration/migration/${SESSION_UID}/snapshots?page=1&limit=1*`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              snapshots: [
                {
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'UPLOADING',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                },
              ],
            }),
          });
        });

        // Simulate the snapshot being uploaded
        let getSnapshotUploadingCalls = 0;
        await page.route(
          `api/cloudmigration/migration/${SESSION_UID}/snapshot/${SNAPSHOT_UID1}?resultPage=1&resultLimit=50*`,
          async (route) => {
            if (getSnapshotUploadingCalls <= 1) {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: getSnapshotUploadingCalls === 1 ? 'PROCESSING' : 'UPLOADING',
                  created: '2025-04-02T21:40:23+02:00',
                  finished: '0001-01-01T00:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'PENDING' })),
                  stats: STATS,
                }),
              });
              getSnapshotUploadingCalls++;
            } else {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  uid: SNAPSHOT_UID1,
                  sessionUid: SESSION_UID,
                  status: 'FINISHED',
                  created: '2025-03-27T12:00:00Z',
                  finished: '2025-03-27T12:00:00Z',
                  results: SNAPSHOT_RESULTS.map((r) => ({ ...r, status: 'OK' })),
                  stats: {
                    types: STATS.types,
                    statuses: SNAPSHOT_RESULTS.reduce<Record<string, number>>((acc, r) => {
                      const status = (r as { status?: string }).status || 'UNKNOWN';
                      acc[status] = (acc[status] || 0) + 1;
                      return acc;
                    }, {}),
                    total: SNAPSHOT_RESULTS.length,
                  },
                }),
              });
            }
          }
        );

        // Upload the snapshot
        await uploadButton.focus();
        await uploadButton.click({ force: true });

        // At least some of the items are marked with "Uploaded to cloud" status
        await expect(page.getByText('Uploaded to cloud')).toHaveCount(22);

        // We can now reconfigure the snapshot
        const reconfigureButton = page.getByTestId('migrate-to-cloud-summary-reconfigure-snapshot-button');
        await expect(reconfigureButton).toBeVisible();
        await reconfigureButton.click();

        // Check the 'Include all' resources checkbox
        await includeAllCheckbox.check({ force: true });
        await expect(includeAllCheckbox).toBeChecked();
      });
    });

    test.describe('with a fake GMS backend implementation', () => {
      test.afterEach(async ({ page }) => {
        const disconnectButton = page.getByTestId('migrate-to-cloud-summary-disconnect-button');
        await expect(disconnectButton).toBeVisible();
        await disconnectButton.click();
      });

      // Manually crafted base64 token for testing, does not contain any sensitive data
      const TEST_TOKEN =
        'eyJUb2tlbiI6ImdsY19kZXZfZXlKdklqb2lNVEl6TkNJc0ltNGlPaUpuY21GbVlXNWhMV05zYjNWa0xXMXBaM0poZEdsdmJuTXRNVEl6TkNJc0ltc2lPaUowWlhOMElpd2liU0k2ZXlKeUlqb2laR1YyTFhWekxXTmxiblJ5WVd3aWZYMEsiLCJJbnN0YW5jZSI6eyJTdGFja0lEIjoxMjM0LCJTbHVnIjoidGVzdC1zbHVnIiwiUmVnaW9uU2x1ZyI6ImRldi11cy1jZW50cmFsIiwiQ2x1c3RlclNsdWciOiJkZXYtdXMtY2VudHJhbC0wIn19Cg==';

      test('creates a snapshot successfully', async ({ page }) => {
        // Visit the migrate to cloud onprem page
        await page.goto('/admin/migrate-to-cloud');

        // Open the connect modal and enter the token
        const connectButton = page.getByTestId('migrate-to-cloud-connect-session-modal-button');
        await expect(connectButton).toBeVisible();
        await connectButton.click();

        const tokenInput = page.getByTestId('migrate-to-cloud-connect-session-modal-token-input');
        await expect(tokenInput).toBeVisible();
        await tokenInput.focus();
        await tokenInput.fill(TEST_TOKEN);

        // Click the connect button to create the token
        const connectSessionButton = page.getByTestId('migrate-to-cloud-connect-session-modal-connect-button');
        await expect(connectSessionButton).toBeVisible();
        await connectSessionButton.click();

        // Build the snapshot
        const buildSnapshotButton = page.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button');
        await expect(buildSnapshotButton).toBeVisible();
        await buildSnapshotButton.click();

        // And the rebuild button should be visible
        const reconfigureButton = page.getByTestId('migrate-to-cloud-summary-reconfigure-snapshot-button');
        await expect(reconfigureButton).toBeVisible();

        // We don't upload the snapshot yet because we need to create a mock server to validate the uploaded items,
        // similarly to what the SMTP (tester) server does
      });
    });
  }
);
