// Libraries
import React, { FunctionComponent } from 'react';
import { css } from 'emotion';
// Components
import { Tooltip, Icon, IconName, IconType, IconSize, IconButton, useTheme, stylesFactory } from '@grafana/ui';
import { e2e } from '@grafana/e2e';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  icon?: IconName;
  tooltip: string;
  classSuffix?: string;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
  iconType?: IconType;
  iconSize?: IconSize;
  noBorder?: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  noBorderContainer: css`
    padding: 0 ${theme.spacing.xs};
    display: flex;
  `,
}));

export const DashNavButton: FunctionComponent<Props> = ({
  icon,
  iconType,
  iconSize,
  tooltip,
  classSuffix,
  onClick,
  href,
  children,
  noBorder,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (noBorder) {
    return (
      <div className={styles.noBorderContainer}>
        <IconButton
          name={icon}
          size={iconSize}
          iconType={iconType}
          tooltip={tooltip}
          tooltipPlacement="bottom"
          onClick={onClick}
        />
      </div>
    );
  }
  return (
    <Tooltip content={tooltip} placement="bottom">
      {onClick ? (
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={e2e.pages.Dashboard.Toolbar.selectors.toolbarItems(tooltip)}
        >
          {icon && <Icon name={icon} type={iconType} size={iconSize || 'lg'} />}
          {children}
        </button>
      ) : noBorder ? (
        <IconButton name={icon} />
      ) : (
        <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
          {icon && <Icon name={icon} type={iconType} size="lg" />}
          {children}
        </a>
      )}
    </Tooltip>
  );
};
