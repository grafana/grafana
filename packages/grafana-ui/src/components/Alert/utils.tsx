import { type AriaRole, cloneElement, type ReactElement, type ReactNode } from 'react';

import { type IconName } from '../../types/icon';
import { mapElements } from '../Banner/mapElements';
import { BannerActionButton, type BannerActionButtonProps } from '../BannerActionButton/BannerActionButton';
import { Button, type ButtonProps } from '../Button/Button';
import { LinkButton, type ButtonLinkProps } from '../LinkButton/LinkButton';

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

const isButton = (element: ReactElement<unknown>): element is ReactElement<ButtonProps> => element.type === Button;

const isLinkButton = (element: ReactElement<unknown>): element is ReactElement<ButtonLinkProps> =>
  element.type === LinkButton;

const isBannerActionButton = (element: ReactElement<unknown>): element is ReactElement<BannerActionButtonProps> =>
  element.type === BannerActionButton;

/**
 * Renders the buttons in an action, at any depth, in the colors of the severity, so that every action button in an
 * Alert looks the same. A Button becomes a BannerActionButton, and a LinkButton becomes a BannerActionButton link. They
 * keep their other props, such as onClick, href, icon, tooltip, disabled and ref, but their variant, fill, size and
 * fullWidth are dropped, and their className is replaced, as BannerActionButton sets its own appearance. A
 * BannerActionButton without a severity or customColor gets the alert's severity. Any other element is rendered as
 * passed.
 */
export const getSeverityAction = (action: ReactNode, severity: AlertVariant): ReactNode =>
  mapElements(action, (element) => {
    if (isButton(element)) {
      const { variant, fill, size, fullWidth, ...buttonProps } = element.props;
      return <BannerActionButton {...buttonProps} severity={severity} />;
    }

    if (isLinkButton(element)) {
      const { variant, fill, size, fullWidth, ...linkProps } = element.props;
      return <BannerActionButton {...linkProps} as="a" severity={severity} />;
    }

    if (isBannerActionButton(element) && !element.props.severity && !element.props.customColor) {
      return cloneElement(element, { severity });
    }

    return undefined;
  });
