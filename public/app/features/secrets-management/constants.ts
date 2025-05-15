import { Entries } from './types';

// @see https://github.com/grafana/grafana-enterprise/blob/secret-service/feature-branch/src/pkg/extensions/secret/decrypt/allow_list.go
export const DECRYPT_ALLOW_LIST = ['actor_k6', 'actor_synthetic-monitoring'] as const;
export type AllowedDecrypter = (typeof DECRYPT_ALLOW_LIST)[number];

export const DECRYPT_ALLOW_LIST_LABEL_MAP: Record<AllowedDecrypter, string> = {
  actor_k6: 'k6',
  'actor_synthetic-monitoring': 'Synthetic Monitoring',
};

export const DECRYPT_ALLOW_LIST_OPTIONS = (
  Object.entries(DECRYPT_ALLOW_LIST_LABEL_MAP) as Entries<typeof DECRYPT_ALLOW_LIST_LABEL_MAP>
).map(([value, label]) => {
  return { label, value };
});
