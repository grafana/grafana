import { type AriaRole, cloneElement, type ReactElement, type ReactNode } from 'react';

import { type IconName } from '../../types/icon';
import { BannerActionButton, type BannerActionButtonProps } from '../BannerActionButton/BannerActionButton';
import { Button, type ButtonProps } from '../Button/Button';
import { LinkButton, type ButtonLinkProps } from '../LinkButton/LinkButton';

import { mapElements } from './mapElements';
import { type BannerSeverity } from './types';

export const rolesBySeverity: Record<BannerSeverity, AriaRole> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
};

export const getIconFromSeverity = (severity: BannerSeverity): IconName => {
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

/** The colors of a banner's action buttons: a severity's outline colors, or a custom color. */
export type BannerActionColor =
  | { severity: BannerSeverity; customColor: undefined }
  | { severity: undefined; customColor: string };

const isButton = (element: ReactElement<unknown>): element is ReactElement<ButtonProps> => element.type === Button;

const isLinkButton = (element: ReactElement<unknown>): element is ReactElement<ButtonLinkProps> =>
  element.type === LinkButton;

const isBannerActionButton = (element: ReactElement<unknown>): element is ReactElement<BannerActionButtonProps> =>
  element.type === BannerActionButton;

/**
 * Renders the buttons in a banner's action, at any depth, in the banner's colors, so that every action button in a
 * banner looks the same. A Button becomes a BannerActionButton, and a LinkButton becomes a BannerActionButton link. They
 * keep their other props, such as onClick, href, icon, tooltip, disabled and ref, but their variant, fill, size and
 * fullWidth are dropped, and their className is replaced, as BannerActionButton sets its own appearance. A
 * BannerActionButton without a severity or customColor gets the banner's colors, and one with its own keeps them unless
 * `replaceOwnColor` is set. Any other element is rendered as passed.
 */
export const restyleAction = (action: ReactNode, color: BannerActionColor, replaceOwnColor = false): ReactNode =>
  mapElements(action, (element) => {
    if (isButton(element)) {
      const { variant, fill, size, fullWidth, ...buttonProps } = element.props;
      return <BannerActionButton {...buttonProps} {...color} />;
    }

    if (isLinkButton(element)) {
      const { variant, fill, size, fullWidth, ...linkProps } = element.props;
      return <BannerActionButton {...linkProps} as="a" {...color} />;
    }

    if (isBannerActionButton(element) && (replaceOwnColor || (!element.props.severity && !element.props.customColor))) {
      return cloneElement(element, color);
    }

    return undefined;
  });

/**
 * Gives every BannerActionButton in a banner's content, at any depth, the banner's action colors, replacing its own,
 * so that buttons composed into the content match the banner. Other buttons are rendered as passed.
 */
export const recolorContentButtons = (children: ReactNode, color: BannerActionColor): ReactNode =>
  mapElements(children, (element) => (isBannerActionButton(element) ? cloneElement(element, color) : undefined));
