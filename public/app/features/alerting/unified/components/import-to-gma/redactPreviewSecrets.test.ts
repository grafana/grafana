import {
  type NotificationChannelOption,
  type NotifierDTO,
  type NotifierType,
  type NotifierVersion,
} from '../../types/alerting';

import {
  PreviewRedactionError,
  buildSecretFieldMap,
  containsRedactedValue,
  redactPreviewSecrets,
  reformatPreviewContent,
} from './redactPreviewSecrets';

describe('redactPreviewSecrets', () => {
  it('round-trips YAML content that contains no secret-shaped fields', () => {
    const yaml = `route:\n  receiver: default\nreceivers:\n  - name: default\n`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).toContain('receiver: default');
    expect(result).toContain('name: default');
  });

  it('round-trips JSON content that contains no secret-shaped fields', () => {
    const json = JSON.stringify({ route: { receiver: 'default' }, receivers: [{ name: 'default' }] }, null, 2);

    const result = redactPreviewSecrets(json, 'json', {});
    const parsedResult = JSON.parse(result);

    expect(parsedResult).toEqual({ route: { receiver: 'default' }, receivers: [{ name: 'default' }] });
  });

  it('redacts values under known secret-bearing key names, including a multi-line block scalar', () => {
    const yaml = `
route:
  receiver: default
receivers:
  - name: default
    email_configs:
      - to: alerts@example.com
        auth_username: smtp-user
        auth_password: |
          -----BEGIN SECRET-----
          Sup3rSecretMultilineValue123
          -----END SECRET-----
global:
  smtp_auth_password: hunter2wayTooSimpleButStillAKey123
`;
    const secretFieldMap = {
      email_configs: new Set(['auth_password']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('Sup3rSecretMultilineValue123');
    expect(result).not.toContain('hunter2wayTooSimpleButStillAKey123');
    expect(result).toContain('to: alerts@example.com');
    expect(result).toContain('auth_username: smtp-user');
  });

  it('redacts secret-shaped values under generic key names, but leaves plain long values alone', () => {
    const yaml = `
receivers:
  - name: custom
    slack_configs:
      - api_url: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX  # trufflehog:ignore
        channel: '#alerts'
    generic_configs:
      - endpoint: https://example.com/callback/AbCdEfGh12345678
        note: xK9pL2vQz8mN4rT6wY1cB3dF5gH7jA0s
        label: normal-label-that-is-quite-long-but-plain-english-words
`;
    const secretFieldMap = {
      slack_configs: new Set(['api_url']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('XXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result).not.toContain('AbCdEfGh12345678');
    expect(result).not.toContain('xK9pL2vQz8mN4rT6wY1cB3dF5gH7jA0s');
    expect(result).toContain("channel: '#alerts'");
    expect(result).toContain('label: normal-label-that-is-quite-long-but-plain-english-words');
  });

  it('redacts a nested secret in JSON-formatted content and re-serializes as JSON', () => {
    const json = JSON.stringify(
      {
        route: { receiver: 'default' },
        receivers: [
          {
            name: 'default',
            pagerduty_configs: [
              { routing_key: 'abcdef0123456789abcdef0123456789', url: 'https://events.pagerduty.com/v2/enqueue' },
            ],
            webhook_configs: [{ url: 'https://hooks.example.com/incoming/9F3kLm2QpXz7Tr5Vb8Nc1Wd4Yh6Ag0Ee' }],
          },
        ],
      },
      null,
      2
    );
    const secretFieldMap = {
      pagerduty_configs: new Set(['routing_key']),
      webhook_configs: new Set(['url']),
    };

    const result = redactPreviewSecrets(json, 'json', secretFieldMap);
    const parsedResult = JSON.parse(result);

    expect(result).not.toContain('abcdef0123456789abcdef0123456789');
    expect(result).not.toContain('9F3kLm2QpXz7Tr5Vb8Nc1Wd4Yh6Ag0Ee');
    expect(parsedResult.receivers[0].pagerduty_configs[0].url).toBe('https://events.pagerduty.com/v2/enqueue');
  });

  it('fails closed on malformed input instead of returning raw content', () => {
    const malformedYaml = 'root:\n\tchild: value';

    expect(() => redactPreviewSecrets(malformedYaml, 'yaml', {})).toThrow(PreviewRedactionError);
  });

  it('redacts a non-string value under a known secret key name', () => {
    const yaml = `
global:
  smtp_auth_password: 20260916
`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('20260916');
    expect(result).toContain('<redacted>');
  });

  it('redacts credentials embedded in a URL via userinfo or a query parameter', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://user:S3cr3tTok3n123@hooks.example.com/notify
      - url: https://hooks.example.com/notify?token=S3cr3tTok3n123
`;
    const secretFieldMap = {
      webhook_configs: new Set(['url']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('S3cr3tTok3n123');
  });

  it('redacts a low-entropy password embedded in a URL via userinfo', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          proxy_url: https://user:password@proxy.example.com:8080
`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('user:password@proxy.example.com');
  });

  it('redacts the authorization credentials field regardless of value shape', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          authorization:
            type: Bearer
            credentials: dXNlcjpwYXNzMTIz==
`;
    const secretFieldMap = {
      webhook_configs: new Set(['http_config.authorization.credentials']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('dXNlcjpwYXNzMTIz==');
  });

  it('redacts a short, lowercase Pushover user_key that has no high-entropy shape', () => {
    const yaml = `
receivers:
  - name: custom
    pushover_configs:
      - user_key: a1b2c3d4e5f6
        title: Incident notice
`;
    const secretFieldMap = {
      pushover_configs: new Set(['user_key']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('a1b2c3d4e5f6');
    expect(result).toContain('title: Incident notice');
  });

  it('leaves a Pushover supplementary url untouched, unlike webhook_configs url', () => {
    const yaml = `
receivers:
  - name: custom
    pushover_configs:
      - user_key: a1b2c3d4e5f6
        url: https://example.com/link-to-incident
`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).toContain('https://example.com/link-to-incident');
  });

  it('redacts a webhook_configs url with no high-entropy segment', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
`;
    const secretFieldMap = {
      webhook_configs: new Set(['url']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('https://hooks.example.com/notify');
  });

  it('redacts a short http header secret regardless of shape', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          http_headers:
            X-Api-Key:
              secrets:
                - shortsecret1
              values:
                - public-label
`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('shortsecret1');
    expect(result).toContain('public-label');
  });

  it('redacts a multiline TLS private key', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          tls_config:
            cert: |
              -----BEGIN CERTIFICATE-----
              FAKE-TEST-FIXTURE-NOT-A-REAL-CERT-0000000000000000000000
              -----END CERTIFICATE-----
            key: |
              -----BEGIN PRIVATE KEY-----
              FAKE-TEST-FIXTURE-NOT-A-REAL-KEY-0000000000000000000000
              -----END PRIVATE KEY-----
`;

    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('FAKE-TEST-FIXTURE-NOT-A-REAL-KEY-0000000000000000000000');
    expect(result).toContain('FAKE-TEST-FIXTURE-NOT-A-REAL-CERT-0000000000000000000000');
  });

  it('redacts an inline OAuth2 client certificate key', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          oauth2:
            client_id: my-client
            client_certificate_key: FAKE-CLIENT-CERT-KEY-PLACEHOLDER
`;
    const secretFieldMap = {
      webhook_configs: new Set(['http_config.oauth2.client_certificate_key']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('FAKE-CLIENT-CERT-KEY-PLACEHOLDER');
    expect(result).toContain('client_id: my-client');
  });
});

describe('redactPreviewSecrets — schema map and override precedence', () => {
  it('redacts a field marked secure in the SecretFieldMap', () => {
    const yaml = `
receivers:
  - name: custom
    slack_configs:
      - api_url: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX  # trufflehog:ignore
        channel: '#alerts'
`;
    const secretFieldMap = {
      slack_configs: new Set(['api_url']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('XXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result).toContain("channel: '#alerts'");
  });

  it('redacts bearer_token under http_config even with an empty SecretFieldMap', () => {
    const yaml = `
receivers:
  - name: custom
    slack_configs:
      - channel: '#alerts'
        http_config:
          bearer_token: s3cr3tBearerT0k3n123456789012
`;
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('s3cr3tBearerT0k3n123456789012');
    expect(result).toContain("channel: '#alerts'");
  });

  it('redacts tls_config.key even with an empty SecretFieldMap', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          tls_config:
            key: |
              -----BEGIN PRIVATE KEY-----
              FAKE-TEST-FIXTURE-NOT-A-REAL-KEY-0000000000000000000000
              -----END PRIVATE KEY-----
`;
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('FAKE-TEST-FIXTURE-NOT-A-REAL-KEY-0000000000000000000000');
  });

  it('redacts http_headers secrets even with an empty SecretFieldMap', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          http_headers:
            X-Api-Key:
              secrets:
                - mysecretapikey123456789
              values:
                - public-label
`;
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('mysecretapikey123456789');
    expect(result).toContain('public-label');
  });

  it('redacts proxy_connect_header values even with an empty SecretFieldMap', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
        http_config:
          proxy_connect_header:
            Proxy-Authorization:
              - Basic dXNlcjpwYXNzd29yZA==
`;
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('Basic dXNlcjpwYXNzd29yZA==');
  });

  it('redacts global.slack_api_url even with an empty SecretFieldMap', () => {
    const yaml = `
global:
  slack_api_url: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX  # trufflehog:ignore
  resolve_timeout: 5m
`;
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).not.toContain('XXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result).toContain('resolve_timeout: 5m');
  });

  it('redacts a low-entropy global.wechat_api_secret', () => {
    const yaml = `
global:
  wechat_api_secret: plainsecret
  resolve_timeout: 5m
`;
    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('plainsecret');
    expect(result).toContain('resolve_timeout: 5m');
  });

  it('redacts a low-entropy global.http_config.basic_auth.password', () => {
    const yaml = `
global:
  http_config:
    basic_auth:
      username: monitoring
      password: plainpassword
`;
    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('plainpassword');
    expect(result).toContain('username: monitoring');
  });

  it('redacts a low-entropy global.http_config.authorization.credentials', () => {
    const yaml = `
global:
  http_config:
    authorization:
      type: Bearer
      credentials: plaincredentials
`;
    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('plaincredentials');
    expect(result).toContain('type: Bearer');
  });

  it('redacts a low-entropy global.http_config.oauth2.client_secret', () => {
    const yaml = `
global:
  http_config:
    oauth2:
      client_id: monitoring
      client_secret: plainclientsecret
      token_url: https://example.com/oauth/token
`;
    const result = redactPreviewSecrets(yaml, 'yaml', {});

    expect(result).not.toContain('plainclientsecret');
    expect(result).toContain('client_id: monitoring');
    expect(result).toContain('https://example.com/oauth/token');
  });

  it('does NOT redact url_file by key name (intentional drop of _file fields)', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url_file: /etc/secrets/token
        url: https://hooks.example.com/notify
`;
    // url_file is removed from the redaction list as a _file field that Grafana rejects at import anyway
    const secretFieldMap = {};

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).toContain('/etc/secrets/token');
  });

  it('redacts webhook_configs url but NOT pushover_configs url via receiver-key scoping', () => {
    const yaml = `
receivers:
  - name: custom
    pushover_configs:
      - user_key: a1b2c3d4e5f6
        url: https://example.com/incident/123
    webhook_configs:
      - url: https://hooks.example.com/notify/S3cr3tTok3n1234567890
`;
    // Only webhook_configs.url is secret, pushover_configs.url is not
    const secretFieldMap = {
      webhook_configs: new Set(['url']),
    };

    const result = redactPreviewSecrets(yaml, 'yaml', secretFieldMap);

    expect(result).toContain('https://example.com/incident/123'); // pushover url stays
    expect(result).not.toContain('S3cr3tTok3n1234567890'); // webhook url redacted
  });
});

// Minimal factories for the buildSecretFieldMap tests below — fill in the required-but-irrelevant
// schema.Field/NotifierVersion/NotifierDTO boilerplate so each test can express just the
// propertyName/secure/subformOptions shape it actually cares about, with no `as` cast needed.
function testField(
  propertyName: string,
  overrides: Partial<NotificationChannelOption> = {}
): NotificationChannelOption {
  return {
    element: 'input',
    inputType: 'text',
    label: '',
    description: '',
    placeholder: '',
    propertyName,
    required: false,
    validationRule: '',
    showWhen: { field: '', is: '' },
    dependsOn: '',
    secure: false,
    ...overrides,
  };
}

function testVersion(version: string, options: NotificationChannelOption[]): NotifierVersion {
  return { version, label: '', description: '', options };
}

function testSchema(type: NotifierType, versions: NotifierVersion[]): NotifierDTO {
  return { type, name: '', description: '', heading: '', versions };
}

describe('buildSecretFieldMap', () => {
  it('builds a secret field map from schemas with secure fields', () => {
    const schemas = [
      testSchema('slack', [testVersion('v0mimir1', [testField('api_url', { secure: true }), testField('channel')])]),
    ];

    const result = buildSecretFieldMap(schemas);

    expect(result.slack_configs).toBeDefined();
    expect(result.slack_configs.has('api_url')).toBe(true);
    expect(result.slack_configs.has('channel')).toBe(false);
  });

  it('correctly handles nested secure fields under subforms', () => {
    const schemas = [
      testSchema('webhook', [
        testVersion('v0mimir1', [
          testField('url'),
          testField('http_config', {
            subformOptions: [
              testField('basic_auth', {
                subformOptions: [testField('username'), testField('password', { secure: true })],
              }),
            ],
          }),
        ]),
      ]),
    ];

    const result = buildSecretFieldMap(schemas);

    expect(result.webhook_configs).toBeDefined();
    expect(result.webhook_configs.has('http_config.basic_auth.password')).toBe(true);
    expect(result.webhook_configs.has('http_config.basic_auth.username')).toBe(false);
  });

  it('handles the teams schema correctly with both v0mimir1 and v0mimir2 versions (regression test)', () => {
    const schemas = [
      testSchema('teams', [
        testVersion('v0mimir1', [testField('webhook_url', { secure: true })]),
        testVersion('v0mimir2', [testField('title'), testField('client_secret', { secure: true })]),
      ]),
    ];

    const result = buildSecretFieldMap(schemas);

    // Both receiver keys should be present
    expect(result.msteams_configs).toBeDefined();
    expect(result.msteamsv2_configs).toBeDefined();

    // msteams_configs (v0mimir1) should have webhook_url
    expect(result.msteams_configs.has('webhook_url')).toBe(true);

    // msteamsv2_configs (v0mimir2) should have client_secret but not title
    expect(result.msteamsv2_configs.has('client_secret')).toBe(true);
    expect(result.msteamsv2_configs.has('title')).toBe(false);
  });

  it('skips schema types not in the legacy version mapping', () => {
    const schemas = [testSchema('oncall', [testVersion('v0mimir1', [testField('integration_url', { secure: true })])])];

    const result = buildSecretFieldMap(schemas);

    // oncall is not in LEGACY_VERSION_TO_RECEIVER_KEY, so no entry should be added
    expect(result.oncall_configs).toBeUndefined();
    expect(Object.keys(result).length).toBe(0);
  });

  it('does not recurse into subforms of a secure field', () => {
    const schemas = [
      testSchema('slack', [
        testVersion('v0mimir1', [
          testField('some_secret', {
            secure: true,
            subformOptions: [testField('nested_public'), testField('nested_private', { secure: true })],
          }),
          testField('channel'),
        ]),
      ]),
    ];

    const result = buildSecretFieldMap(schemas);

    // The secure field itself is added, but its subform is not traversed
    expect(result.slack_configs.has('some_secret')).toBe(true);
    expect(result.slack_configs.has('some_secret.nested_public')).toBe(false);
    expect(result.slack_configs.has('some_secret.nested_private')).toBe(false);
  });

  it('handles multiple nested levels correctly', () => {
    const schemas = [
      testSchema('email', [
        testVersion('v0mimir1', [
          testField('smtp_config', {
            subformOptions: [
              testField('auth', {
                subformOptions: [
                  testField('oauth2', { subformOptions: [testField('client_secret', { secure: true })] }),
                ],
              }),
            ],
          }),
        ]),
      ]),
    ];

    const result = buildSecretFieldMap(schemas);

    expect(result.email_configs.has('smtp_config.auth.oauth2.client_secret')).toBe(true);
  });

  it('collects multiple secure paths from the same schema', () => {
    const schemas = [
      testSchema('pagerduty', [
        testVersion('v0mimir1', [
          testField('routing_key', { secure: true }),
          testField('service_key', { secure: true }),
          testField('description'),
        ]),
      ]),
    ];

    const result = buildSecretFieldMap(schemas);

    expect(result.pagerduty_configs.has('routing_key')).toBe(true);
    expect(result.pagerduty_configs.has('service_key')).toBe(true);
    expect(result.pagerduty_configs.has('description')).toBe(false);
    expect(result.pagerduty_configs.size).toBe(2);
  });
});

describe('containsRedactedValue', () => {
  it('returns true when the content contains the redaction marker', () => {
    expect(containsRedactedValue('api_url: <redacted>\nchannel: "#alerts"')).toBe(true);
  });

  it('returns false for content with no redaction marker', () => {
    expect(containsRedactedValue('api_url: https://example.com\nchannel: "#alerts"')).toBe(false);
  });

  it('is an exact match, not a loose one', () => {
    expect(containsRedactedValue('api_url: <REDACTED>')).toBe(false);
    expect(containsRedactedValue('api_url: < redacted >')).toBe(false);
  });
});

describe('reformatPreviewContent', () => {
  it('normalizes flush-indented sequences to the same style redactPreviewSecrets produces', () => {
    // Sequence dashes aligned with their parent key (flush style) — a valid, common YAML
    // convention that differs from js-yaml dump()'s own default (extra-indented dashes).
    const flushStyleYaml = `route:
  receiver: default-email
  routes:
  - matchers:
    - severity=critical
    receiver: escalate-pagerduty
`;
    const secretFieldMap = {};

    const reformatted = reformatPreviewContent(flushStyleYaml, 'yaml');
    const redacted = redactPreviewSecrets(flushStyleYaml, 'yaml', secretFieldMap);

    // Both go through the same parse+dump pipeline, so structure/indentation matches exactly —
    // toggling reveal/hide must not reflow the document even though nothing here is a secret.
    expect(reformatted).toBe(redacted);
    expect(reformatted).toContain('  routes:\n    - matchers:\n        - severity=critical\n');
  });

  it('does not redact anything, unlike redactPreviewSecrets', () => {
    const yaml = `
global:
  smtp_auth_password: hunter2wayTooSimpleButStillAKey123
`;
    const result = reformatPreviewContent(yaml, 'yaml');

    expect(result).toContain('hunter2wayTooSimpleButStillAKey123');
    expect(result).not.toContain('<redacted>');
  });

  it('fails closed on malformed input, matching redactPreviewSecrets', () => {
    const malformedYaml = 'root:\n\tchild: value';

    expect(() => reformatPreviewContent(malformedYaml, 'yaml')).toThrow(PreviewRedactionError);
  });

  it('round-trips JSON content with the same formatting redactPreviewSecrets produces', () => {
    const json = JSON.stringify({ route: { receiver: 'default' } }, null, 2);

    expect(reformatPreviewContent(json, 'json')).toBe(redactPreviewSecrets(json, 'json', {}));
  });
});
