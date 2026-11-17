import { type MouseEventHandler } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { type Props as AlertProps } from '../Alert/Alert';
import { getIconFromSeverity, rolesBySeverity } from '../Alert/utils';
import { Banner } from '../Banner/Banner';

import { AlertActionButton } from './AlertActionButton';

type ActionProps =
  | {
      /** Click handler for the action button. */
      action: MouseEventHandler<HTMLButtonElement>;
      /** Label of the action button. Required when `action` is set. */
      actionLabel: string;
    }
  | { action?: never; actionLabel?: never };

export type AlertBannerProps = Omit<AlertProps, 'action'> & ActionProps;

/**
 * An alert banner displays an important message on a saturated background. It takes the same props as Alert,
 * except that `action` is a click handler and `actionLabel` is the label of the button it renders.
 */
export const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ severity = 'error', role, action, actionLabel, ...restProps }, ref) => {
    const theme = useTheme2();
    const color = theme.colors[severity];
    const visualRefreshEnabled = theme.flags.visualDesignRefresh;

    return (
      <Banner
        ref={ref}
        role={role || rolesBySeverity[severity]}
        icon={getIconFromSeverity(severity)}
        backgroundColor={visualRefreshEnabled ? color.backgroundEmphasis : color.main}
        borderColor={visualRefreshEnabled ? color.subtleBorder : color.borderTransparent}
        iconColor={color.contrastText}
        textColor={color.contrastText}
        emphasisColor={color.shade}
        dismissIconColor={color.contrastText}
        dataTestId={selectors.components.Alert.alertV2(severity)}
        action={action && <AlertActionButton onClick={action}>{actionLabel}</AlertActionButton>}
        {...restProps}
      />
    );
  }
);

AlertBanner.displayName = 'AlertBanner';
