import { IconName } from '@grafana/data';

export const BASE_PATH = 'admin/authentication/';

// TODO Remove when this is available from API
export const UIMap: Record<string, [IconName, string]> = {
  github: ['github', 'GitHub'],
  gitlab: ['gitlab', 'GitLab'],
  google: ['google', 'Google'],
  generic_oauth: ['lock', 'Generic OAuth'],
  grafana_com: ['grafana', 'Grafana.com'],
  azuread: ['microsoft', 'Azure AD'],
  okta: ['okta', 'Okta'],
  scim: ['scim', 'SCIM'],
};
