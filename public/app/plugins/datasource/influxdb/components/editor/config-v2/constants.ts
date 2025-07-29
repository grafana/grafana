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
  { label: 'URL and authentication', id: 'url', isOpen: true },
  { label: 'Database settings', id: 'tls', isOpen: true },
  { label: 'Save & test', id: `${selectors.pages.DataSource.saveAndTest}`, isOpen: true },
];

export const CONFIG_SECTION_HEADERS_WITH_PDC = [
  { label: 'URL and authentication', id: 'url', isOpen: true },
  { label: 'Database settings', id: 'tls', isOpen: true },
  { label: 'Private data source connect', id: 'pdc', isOpen: true },
  { label: 'Save & test', id: `${selectors.pages.DataSource.saveAndTest}`, isOpen: true },
];

export const HTTP_MODES: ComboboxOption[] = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
];

export const getInlineLabelStyles = (theme: GrafanaTheme2, transparent = false, width?: number | 'auto') => {
  return {
    label: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.md,
      backgroundColor: transparent ? 'transparent' : theme.colors.background.secondary,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      width: '240px',
      color: theme.colors.text.primary,
    }),
  };
};
