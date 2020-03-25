import { GrafanaTheme } from '@grafana/data';
import { ComponentSize } from '../../types/size';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'inverse' | 'transparent' | 'destructive' | 'link';

export interface StyleDeps {
  theme: GrafanaTheme;
  size: ComponentSize;
  variant: ButtonVariant;
  textAndIcon?: boolean;
}

export interface ButtonStyles {
  button: string;
  iconWrap: string;
  icon?: string;
}
