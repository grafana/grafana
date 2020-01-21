import { GrafanaTheme } from '@grafana/data';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'inverse' | 'transparent' | 'destructive' | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface StyleDeps {
  theme: GrafanaTheme;
  size: ButtonSize;
  variant: ButtonVariant;
  textAndIcon?: boolean;
}

export interface ButtonStyles {
  button: string;
  iconWrap: string;
  icon?: string;
}
