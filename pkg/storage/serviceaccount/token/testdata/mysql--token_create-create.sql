INSERT INTO `serviceaccount_token` (
  `id`,
  `namespace`,
  `name`,
  `key`,
  `created`,
  `updated`,
  `last_used_at`,
  `service_account_name`,
  `is_revoked`,
  `expires`
) VALUES (
  '83f63f4c-a28b-4378-87cc-77e2b552ecbf',
  'org-1',
  'deploy',
  'hashed-key',
  '2025-01-01 00:00:00 +0000 UTC',
  '2025-01-01 00:00:00 +0000 UTC',
  NULL,
  'sa-one',
  FALSE,
  1735693200
);
