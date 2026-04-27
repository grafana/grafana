import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { GrafanaTheme } from '@grafana/data/types';

export interface Themeable {
  theme: GrafanaTheme;
}

export interface Themeable2 {
  theme: GrafanaTheme2;
}
