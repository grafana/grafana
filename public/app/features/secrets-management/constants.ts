// @see https://github.com/grafana/grafana-enterprise/blob/secret-service/feature-branch/src/pkg/extensions/secret/decrypt/allow_list.go
export const ALLOWED_SECRET_DECRYPTERS = [
  'k6.grafana.app/secret-decrypter-thing',
  'synthetic-monitoring.grafana.app/secret-decrypter-thing',
];

export const MOCKED_SECRET_KEEPER = 'my-keeper-1';

export const MOCKED_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
];
