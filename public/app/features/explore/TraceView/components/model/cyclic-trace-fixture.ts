// Copyright (c) 2025 Grafana Labs
//
// Test fixture for GitHub issue #110330
// This trace contains cyclic span references that cause browser crashes
// Source: https://github.com/grafana/grafana/issues/110330#issuecomment-3397161551
// Raw data provided by @ifrost for Test Data Source with Raw Frames scenario

/**
 * EXACT test data from GitHub issue #110330 demonstrating cyclic span references.
 *
 * The cycle structure:
 * - Span "75c665dfb6810000" (root, index 0) has a FOLLOWS_FROM reference to span "75c665dfb6810002" (child, index 2)
 * - Span "75c665dfb6810002" (index 2) has parentSpanID = "75c665dfb6810000" (creating CHILD_OF to root)
 * - This creates a cycle: root -> child (via CHILD_OF) and root -> child (via FOLLOWS_FROM)
 *
 * Expected behavior:
 * - BEFORE FIX: TypeError: Cannot read properties of undefined (reading 'spanID') OR infinite loop
 * - AFTER FIX: Trace displays successfully with console warning about cyclic reference
 *
 * To test in Grafana UI:
 * 1. Add Test Data Source
 * 2. Select "Raw Frames" scenario
 * 3. Paste this JSON: export const rawTestDataFrameJSON
 * 4. View trace - should crash before fix, work after fix
 */

/**
 * Raw JSON format for pasting into Test Data Source -> Raw Frames scenario
 * This is the exact format provided by @ifrost in the issue
 */
export const rawTestDataFrameJSON = [
  {
    schema: {
      meta: {
        preferredVisualisationType: 'trace',
      },
      fields: [
        { name: 'traceID', type: 'string', config: {} },
        { name: 'spanID', type: 'string', config: {} },
        { name: 'parentSpanID', type: 'string', config: {} },
        { name: 'operationName', type: 'string', config: {} },
        { name: 'serviceName', type: 'string', config: {} },
        { name: 'serviceTags', type: 'other', config: {} },
        { name: 'startTime', type: 'number', config: {} },
        { name: 'duration', type: 'number', config: {} },
        { name: 'logs', type: 'other', config: {} },
        { name: 'references', type: 'other', config: {} },
        { name: 'tags', type: 'other', config: {} },
        { name: 'kind', type: 'string', config: {} },
        { name: 'statusCode', type: 'number', config: {} },
        { name: 'warnings', type: 'other', config: {} },
        { name: 'stackTraces', type: 'other', config: {} },
      ],
    },
    data: {
      values: [
        ['75c665dfb6810000', '75c665dfb6810000', '75c665dfb6810000'], // traceID
        ['75c665dfb6810000', '75c665dfb6810001', '75c665dfb6810002'], // spanID
        ['', '75c665dfb6810000', '75c665dfb6810000'], // parentSpanID
        ['Operation 0', 'Operation 1', 'Operation 2'], // operationName
        ['Service 0', 'Service 1', 'Service 2'], // serviceName
        [
          [
            { key: 'client-uuid', value: '6238bacefsecba865' },
            { key: 'service.name', value: 'Service0' },
            { key: 'ip', value: '0.0.0.1' },
            { key: 'latest_version', value: false },
          ],
          [
            { key: 'client-uuid', value: '6238bacefsecba865' },
            { key: 'service.name', value: 'Service1' },
            { key: 'ip', value: '0.0.0.1' },
            { key: 'latest_version', value: false },
          ],
          [
            { key: 'client-uuid', value: '6238bacefsecba865' },
            { key: 'service.name', value: 'Service2' },
            { key: 'ip', value: '0.0.0.1' },
            { key: 'latest_version', value: false },
          ],
        ], // serviceTags
        [1760350434399, 1760350434499, 1760350434599], // startTime
        [300, 300, 300], // duration
        [
          [
            {
              timestamp: 1760350434399,
              fields: [{ key: 'msg', value: 'Service updated' }],
            },
            {
              timestamp: 1760350434599,
              fields: [{ key: 'host', value: 'app' }],
            },
          ],
          [],
          [],
        ], // logs
        [
          [
            {
              // ⚠️ THIS IS THE CYCLIC REFERENCE
              // Root span (index 0, ID: 75c665dfb6810000) references its child (index 2, ID: 75c665dfb6810002)
              refType: 'FOLLOWS_FROM',
              spanID: '75c665dfb6810002',
              traceID: '75c665dfb6810000',
            },
          ],
          [
            {
              refType: 'EXTERNAL',
              spanID: '75c665dfb6810001',
              traceID: '75c665dfb6810000',
              tags: [
                { key: 'external.service', value: 'Service1' },
                { key: 'resource.pod', value: 'Pod1' },
              ],
            },
          ],
          [
            {
              refType: 'EXTERNAL',
              spanID: '75c665dfb6810001',
              traceID: '75c665dfb6810000',
              tags: [
                { key: 'external.service', value: 'Service2' },
                { key: 'resource.pod', value: 'Pod2' },
              ],
            },
          ],
        ], // references
        [
          [
            { key: 'http.method', value: 'POST' },
            { key: 'http.status_code', value: 200 },
            { key: 'http.url', value: 'Service0:80' },
          ],
          [
            { key: 'http.method', value: 'POST' },
            { key: 'http.status_code', value: 200 },
            { key: 'http.url', value: 'Service1:80' },
          ],
          [
            { key: 'http.method', value: 'POST' },
            { key: 'http.status_code', value: 200 },
            { key: 'http.url', value: 'Service2:80' },
          ],
        ], // tags
        ['client', '', ''], // kind
        [2, 1, 2], // statusCode
        [
          [
            '[2025-07-30T14:12:09Z] [payment-service] Delayed response from external payment gateway (Stripe). Request ID: 8f3a7c2b-ff13-4e3c-b610-18a92c8b199d. Latency: 3421ms. Threshold: 2500ms.',
            '[2025-07-30T14:14:42Z] [notification-service] Email delivery failed for user_id=93244 (Email: user@example.com). SMTP server responded with status 421: "Service not available, closing transmission channel".',
            '[2025-07-30T14:18:55Z] [user-profile-service] Deprecated API version used in request: /v1/profile/update. Recommend migrating to /v2/profile/update. Client ID: svc-auth-34.',
          ],
          [],
          [
            '[2025-07-30T14:12:09Z] [payment-service] Delayed response from external payment gateway (Stripe). Request ID: 8f3a7c2b-ff13-4e3c-b610-18a92c8b199d. Latency: 3421ms. Threshold: 2500ms.',
            '[2025-07-30T14:14:42Z] [notification-service] Email delivery failed for user_id=93244 (Email: user@example.com). SMTP server responded with status 421: "Service not available, closing transmission channel".',
            '[2025-07-30T14:18:55Z] [user-profile-service] Deprecated API version used in request: /v1/profile/update. Recommend migrating to /v2/profile/update. Client ID: svc-auth-34.',
          ],
        ], // warnings
        [
          [
            'Traceback (most recent call last):\n  File "/app/services/payment.py", line 112, in process_transaction\n    response = gateway.charge(card_info, amount)\n  File "/app/lib/gateway/stripe_client.py", line 76, in charge\n    return self._send_request(payload)\n  File "/app/lib/gateway/stripe_client.py", line 45, in _send_request\n    raise GatewayTimeoutError("Stripe request timed out after 3000ms")\ngateway.exceptions.GatewayTimeoutError: Stripe request timed out after 3000ms\n',
            'Traceback (most recent call last):\n  File "/usr/src/app/main.py", line 27, in <module>\n    run_app()\n  File "/usr/src/app/core/server.py", line 88, in run_app\n    initialize_services()\n  File "/usr/src/app/core/init.py", line 52, in initialize_services\n    db.connect()\n  File "/usr/src/app/db/connection.py", line 31, in connect\n    raise DatabaseConnectionError("Failed to connect to database: timeout after 5s")\ndb.exceptions.DatabaseConnectionError: Failed to connect to database: timeout after 5s\n',
          ],
          [],
          [],
        ], // stackTraces
      ],
    },
  },
];

/**
 * Self-referencing span scenario from issue #106589
 * A span that references itself, causing infinite loops in ancestor traversal
 */
export const selfReferencingSpanTrace: DataFrame = {
  name: 'Trace',
  length: 2,
  fields: [
    {
      name: 'traceID',
      type: 'string',
      config: {},
      values: ['trace001', 'trace001'],
    },
    {
      name: 'spanID',
      type: 'string',
      config: {},
      values: ['span-root', 'span-child'],
    },
    {
      name: 'parentSpanID',
      type: 'string',
      config: {},
      values: ['', 'span-root'],
    },
    {
      name: 'operationName',
      type: 'string',
      config: {},
      values: ['root-operation', 'child-operation'],
    },
    {
      name: 'serviceName',
      type: 'string',
      config: {},
      values: ['order-processor', 'order-processor'],
    },
    {
      name: 'serviceTags',
      type: 'other',
      config: {},
      values: [
        [{ key: 'service.name', value: 'order-processor' }],
        [{ key: 'service.name', value: 'order-processor' }],
      ],
    },
    {
      name: 'startTime',
      type: 'number',
      config: {},
      values: [1000, 1100],
    },
    {
      name: 'duration',
      type: 'number',
      config: {},
      values: [500, 300],
    },
    {
      name: 'logs',
      type: 'other',
      config: {},
      values: [[], []],
    },
    {
      name: 'references',
      type: 'other',
      config: {},
      values: [
        [
          {
            // Root references the child (creating a forward reference)
            refType: 'FOLLOWS_FROM',
            spanID: 'span-child',
            traceID: 'trace001',
          },
        ],
        [],
      ],
    },
    {
      name: 'tags',
      type: 'other',
      config: {},
      values: [[], []],
    },
    {
      name: 'kind',
      type: 'string',
      config: {},
      values: ['server', 'client'],
    },
    {
      name: 'statusCode',
      type: 'number',
      config: {},
      values: [0, 0],
    },
    {
      name: 'warnings',
      type: 'other',
      config: {},
      values: [[], []],
    },
    {
      name: 'stackTraces',
      type: 'other',
      config: {},
      values: [[], []],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
};
