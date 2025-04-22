import { selectors } from '@grafana/e2e-selectors';
import { AuthMethod } from '@grafana/plugin-ui';
import { ComboboxOption } from '@grafana/ui';

export const RADIO_BUTTON_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false },
];

export const CONFIG_SECTION_HEADERS = [
  { label: 'URL and connection', id: 'url', isOpen: true },
  { label: 'Database Connection Settings', id: 'tls', isOpen: true },
  { label: 'Save & test', id: `${selectors.pages.DataSource.saveAndTest}`, isOpen: true },
];

export const httpModes: ComboboxOption[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

export const authenticationOptions: Partial<Record<AuthMethod, ComboboxOption<AuthMethod>>> = {
  [AuthMethod.BasicAuth]: {
    label: 'Basic authentication',
    value: AuthMethod.BasicAuth,
    description: 'Authenticate with your data source username and password',
  },
  [AuthMethod.OAuthForward]: {
    label: 'Forward OAuth Identity',
    value: AuthMethod.OAuthForward,
    description:
      'Forward the OAuth access token (and if available: the OIDC ID token) of the user querying to the data source',
  },
  [AuthMethod.NoAuth]: {
    label: 'No Authentication',
    value: AuthMethod.NoAuth,
    description: 'Data source is available without authentication',
  },
};
