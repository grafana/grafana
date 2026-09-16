import { PreviewRedactionError, redactPreviewSecrets } from './redactPreviewSecrets';

describe('redactPreviewSecrets', () => {
  it('round-trips YAML content that contains no secret-shaped fields', () => {
    const yaml = `route:\n  receiver: default\nreceivers:\n  - name: default\n`;

    const result = redactPreviewSecrets(yaml, 'yaml');

    expect(result).toContain('receiver: default');
    expect(result).toContain('name: default');
  });

  it('round-trips JSON content that contains no secret-shaped fields', () => {
    const json = JSON.stringify({ route: { receiver: 'default' }, receivers: [{ name: 'default' }] }, null, 2);

    const result = redactPreviewSecrets(json, 'json');
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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(json, 'json');
    const parsedResult = JSON.parse(result);

    expect(result).not.toContain('abcdef0123456789abcdef0123456789');
    expect(result).not.toContain('9F3kLm2QpXz7Tr5Vb8Nc1Wd4Yh6Ag0Ee');
    expect(parsedResult.receivers[0].pagerduty_configs[0].url).toBe('https://events.pagerduty.com/v2/enqueue');
  });

  it('fails closed on malformed input instead of returning raw content', () => {
    const malformedYaml = 'root:\n\tchild: value';

    expect(() => redactPreviewSecrets(malformedYaml, 'yaml')).toThrow(PreviewRedactionError);
  });

  it('redacts a non-string value under a known secret key name', () => {
    const yaml = `
global:
  smtp_auth_password: 20260916
`;

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

    expect(result).not.toContain('S3cr3tTok3n123');
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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

    expect(result).toContain('https://example.com/link-to-incident');
  });

  it('redacts a webhook_configs url with no high-entropy segment', () => {
    const yaml = `
receivers:
  - name: custom
    webhook_configs:
      - url: https://hooks.example.com/notify
`;

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

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

    const result = redactPreviewSecrets(yaml, 'yaml');

    expect(result).not.toContain('FAKE-CLIENT-CERT-KEY-PLACEHOLDER');
    expect(result).toContain('client_id: my-client');
  });
});
