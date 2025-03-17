// @see https://github.com/grafana/grafana-enterprise/blob/secret-service/feature-branch/src/pkg/extensions/secret/decrypt/allow_list.go
export const ALLOWED_SECRET_DECRYPTERS = {
  'k6': 'actor_k6',
  'Synthetic Monitoring': 'actor_synthetic-monitoring',
};

export const MOCKED_SECRET_KEEPER = 'kp-default-sql';

export const MOCKED_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
];
