import { type AriaRole, cloneElement, isValidElement, type MouseEvent, type ReactNode } from 'react';

import { type IconName } from '../../types/icon';
import { Button, type ButtonProps, type ButtonVariant } from '../Button/Button';

import { type AlertVariant } from './Alert';

export const rolesBySeverity: Record<AlertVariant, AriaRole> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
};

export const getIconFromSeverity = (severity: AlertVariant): IconName => {
  switch (severity) {
    case 'error':
      return 'exclamation-circle';
    case 'warning':
      return 'exclamation-triangle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
  }
};

export const buttonVariantsBySeverity: Record<AlertVariant, ButtonVariant> = {
  error: 'destructive',
  warning: 'warning',
  info: 'info',
  success: 'success',
};

export const getOutlineAction = (action: ReactNode, variant: ButtonVariant): ReactNode => {
  if (isValidElement<ButtonProps>(action) && action.type === Button) {
    return cloneElement(action, { variant, fill: 'outline' });
  }

  return action;
};

// Banner renders a Button passed as buttonContent directly, so wrapping here decides how the dismiss button looks.
export const getDismissButton = (
  buttonContent: ReactNode,
  onRemove: ((event: MouseEvent) => void) | undefined,
  variant: ButtonVariant
): ReactNode => {
  const isButtonElement = isValidElement(buttonContent) && buttonContent.type === Button;

  if (!buttonContent || !onRemove || isButtonElement) {
    return buttonContent;
  }

  return (
    <Button variant={variant} onClick={onRemove} type="button">
      {buttonContent}
    </Button>
  );
};
