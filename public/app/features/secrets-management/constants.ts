// @see https://github.com/grafana/grafana-enterprise/blob/secret-service/feature-branch/src/pkg/extensions/secret/decrypt/allow_list.go
export const DECRYPT_ALLOW_LIST = ['k6', 'synthetic-monitoring'];
export type AllowedDecrypter = (typeof DECRYPT_ALLOW_LIST)[number];

export const DECRYPT_ALLOW_LIST_LABEL_MAP: Record<AllowedDecrypter, string> = {
  k6: 'k6',
  'synthetic-monitoring': 'Synthetic Monitoring',
};

export const DECRYPT_ALLOW_LIST_OPTIONS = Object.entries(DECRYPT_ALLOW_LIST_LABEL_MAP).map(([value, label]) => {
  return { label, value };
});

export const SUBDOMAIN_MAX_LENGTH = 253;
export const LABEL_MAX_LENGTH = 63;
export const SECRETS_MAX_LABELS = 10;
export const SECURE_VALUE_MAX_LENGTH = 24576; // 24 KiB
