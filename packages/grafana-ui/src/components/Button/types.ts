import { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentType } from 'react';
import { GrafanaTheme, Themeable } from '../../types';

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

export interface CommonButtonProps {
  size?: ButtonSize;
  variant?: ButtonVariant;
  /**
   * icon prop is a temporary solution. It accepts legacy icon class names for the icon to be rendered.
   * TODO: migrate to a component when we are going to migrate icons to @grafana/ui
   */
  icon?: string;
  className?: string;
}

export interface LinkButtonProps extends CommonButtonProps, AnchorHTMLAttributes<HTMLAnchorElement> {
  disabled?: boolean;
}
export interface ButtonProps extends CommonButtonProps, ButtonHTMLAttributes<HTMLButtonElement> {}

export interface AbstractButtonProps extends CommonButtonProps, Themeable {
  renderAs: ComponentType<CommonButtonProps> | string;
}
