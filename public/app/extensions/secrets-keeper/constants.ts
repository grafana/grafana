import { config } from '@grafana/runtime';

// Base URL for secrets keeper feature (sub-route of /admin/secrets)
export const SECRETS_KEEPER_BASE_URL = `${config.appSubUrl}/admin/secrets/keepers`;

// Route paths
export const SECRETS_KEEPER_LIST_URL = SECRETS_KEEPER_BASE_URL;
export const SECRETS_KEEPER_NEW_URL = `${SECRETS_KEEPER_BASE_URL}/new`;
export const SECRETS_KEEPER_DETAIL_URL = (name: string) => `${SECRETS_KEEPER_BASE_URL}/${name}`;
export const SECRETS_KEEPER_EDIT_URL = (name: string) => `${SECRETS_KEEPER_BASE_URL}/${name}/edit`;
