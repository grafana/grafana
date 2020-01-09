import { GrafanaTheme } from '@grafana/data';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'inverse' | 'transparent' | 'destructive' | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface StyleDeps {
  theme: GrafanaTheme;
  size: ButtonSize;
  variant: ButtonVariant;
}

export interface ButtonStyles {
  button: string;
  buttonWithIcon: string;
  iconButton: string;
  iconWrap: string;
  icon?: string;
}
