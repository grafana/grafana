import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { type Props as AlertProps } from '../Alert/Alert';
import { getIconFromSeverity, rolesBySeverity } from '../Alert/utils';
import { Banner } from '../Banner/Banner';

export type AlertBannerProps = AlertProps;

/**
 * An alert banner displays an important message on a saturated background. It takes the same props as Alert.
 */
export const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ severity = 'error', role, ...restProps }, ref) => {
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
        {...restProps}
      />
    );
  }
);

AlertBanner.displayName = 'AlertBanner';
