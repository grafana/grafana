import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { type Props as AlertProps } from '../Alert/Alert';
import { getIconFromSeverity, rolesBySeverity } from '../Alert/utils';
import { Banner } from '../Banner/Banner';
import { mapElements } from '../Banner/mapElements';
import { BannerActionButton, type BannerActionButtonProps } from '../BannerActionButton/BannerActionButton';

import { getAlertBannerColors } from './AlertBanner.styles';

// Omit does not distribute over a union, and would collapse the button and anchor forms into one.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type ActionProps =
  | {
      /**
       * Props of the action button, passed to a BannerActionButton: `onClick` for a button, or `as="a"` with `href`,
       * and `target` if needed, for a link.
       */
      action: DistributiveOmit<BannerActionButtonProps, 'severity' | 'customColor' | 'children'>;
      /** Label of the action button. Required when `action` is set. */
      actionLabel: string;
    }
  | { action?: never; actionLabel?: never };

export type AlertBannerProps = Omit<AlertProps, 'action'> &
  ActionProps & {
    /** Icon shown at the start of the banner. Defaults to the icon for the severity. */
    icon?: IconName;
    /**
     * Replaces the icon with a spinner of the same size and color, and hides the dismiss control: the X icon or the
     * buttonContent button.
     */
    isLoading?: boolean;
  };

const isBannerActionButton = (
  element: React.ReactElement<unknown>
): element is React.ReactElement<BannerActionButtonProps> => element.type === BannerActionButton;

/**
 * Gives every BannerActionButton in the children, at any depth, the color of the banner's action button, so that
 * buttons composed into the body match it. The color replaces the button's own `severity` or `customColor`, because a
 * severity's outline colors don't contrast with the saturated background of the same severity.
 */
const applyActionColor = (children: React.ReactNode, color: string): React.ReactNode =>
  mapElements(children, (element) =>
    isBannerActionButton(element) ? React.cloneElement(element, { severity: undefined, customColor: color }) : undefined
  );

/**
 * An alert banner displays an important message on a saturated background. It takes Alert's props with one
 * difference: `action` takes the props of the action button or link, not an element as in Alert, and `actionLabel` is
 * its label. It also takes `icon` and `isLoading`. For a subtle background, use Alert.
 */
export const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ severity = 'error', role, action, actionLabel, icon, isLoading, children, ...restProps }, ref) => {
    const theme = useTheme2();
    const color = theme.colors[severity];
    const { background, iconBox, text, border } = getAlertBannerColors(theme, severity);
    const visualRefreshEnabled = theme.flags.visualDesignRefresh;

    return (
      <Banner
        ref={ref}
        role={role || rolesBySeverity[severity]}
        icon={icon ?? getIconFromSeverity(severity)}
        isLoading={isLoading}
        backgroundColor={background}
        borderColor={visualRefreshEnabled ? border : color.borderTransparent}
        iconColor={text}
        textColor={text}
        emphasisColor={iconBox}
        dismissIconColor={text}
        dataTestId={selectors.components.Alert.alertV2(severity)}
        action={
          action && (
            <BannerActionButton {...action} customColor={text}>
              {actionLabel}
            </BannerActionButton>
          )
        }
        {...restProps}
      >
        {applyActionColor(children, text)}
      </Banner>
    );
  }
);

AlertBanner.displayName = 'AlertBanner';
