import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AuthMethod } from '@grafana/plugin-ui';
import { ComboboxOption } from '@grafana/ui';

export const RADIO_BUTTON_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false },
];

export const AUTH_RADIO_BUTTON_OPTIONS = [
  { label: 'No Authentication', value: AuthMethod.NoAuth },
  { label: 'Basic Authentication', value: AuthMethod.BasicAuth },
  { label: 'Forward OAuth Identity', value: AuthMethod.OAuthForward },
];

export const CONFIG_SECTION_HEADERS = [
  { label: 'URL and authentication', id: 'url', isOpen: true, isOptional: false },
  { label: 'Database settings', id: 'db', isOpen: true, isOptional: false },
  { label: 'TLS/SSL settings', id: 'tls', isOpen: false, isOptional: true },
  { label: 'Save & test', id: `${selectors.pages.DataSource.saveAndTest}`, isOpen: true, isOptional: null },
];

export const CONFIG_SECTION_HEADERS_WITH_PDC = [
  { label: 'URL and authentication', id: 'url', isOpen: true, isOptional: false },
  { label: 'Database settings', id: 'db', isOpen: true, isOptional: false },
  { label: 'TLS/SSL settings', id: 'tls', isOpen: false, isOptional: true },
  { label: 'Private data source connect', id: 'pdc', isOpen: false, isOptional: true },
  { label: 'Save & test', id: `${selectors.pages.DataSource.saveAndTest}`, isOpen: true, isOptional: null },
];

export const HTTP_MODES: ComboboxOption[] = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
];

export const CONTAINER_MIN_WIDTH = '450px';
