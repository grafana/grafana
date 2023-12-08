import React, { ButtonHTMLAttributes, FC } from 'react';

import { Button, ButtonVariant, IconName, Spinner } from '@grafana/ui';

type ComponentSize = 'xs' | 'sm' | 'md' | 'lg';

type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export interface LoaderButtonProps extends ButtonProps {
  loading?: boolean;
}

export const LoaderButton: FC<LoaderButtonProps> = ({
  children,
  className,
  disabled,
  loading = false,
  size = 'md',
  ...props
}) => (
  <Button className={className} size={size} disabled={loading || disabled} {...props}>
    {loading ? <Spinner /> : children}
  </Button>
);
