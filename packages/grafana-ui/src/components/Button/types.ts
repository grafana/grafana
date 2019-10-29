import { GrafanaTheme } from '../../types';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'inverse' | 'transparent' | 'destructive';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface StyleDeps {
  theme: GrafanaTheme;
  size: ButtonSize;
  variant: ButtonVariant;
  withIcon: boolean;
}

export interface ButtonStyles {
  button: string;
  iconWrap: string;
  icon: string;
}
