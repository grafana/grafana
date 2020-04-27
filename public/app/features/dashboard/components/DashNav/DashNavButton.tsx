// Libraries
import React, { FunctionComponent } from 'react';
// Components
import { Icon, IconName, IconSize, IconType, Tooltip } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  icon?: IconName;
  tooltip: string;
  classSuffix?: string;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
  iconType?: IconType;
  iconSize?: IconSize;
}

export const DashNavButton: FunctionComponent<Props> = ({
  icon,
  iconType,
  iconSize,
  tooltip,
  classSuffix,
  onClick,
  href,
  children,
}) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip} placement="bottom">
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={selectors.pages.Dashboard.Toolbar.toolbarItems(tooltip)}
        >
          {icon && <Icon name={icon} type={iconType} size={iconSize || 'lg'} />}
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip} placement="bottom">
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        {icon && <Icon name={icon} type={iconType} size="lg" />}
        {children}
      </a>
    </Tooltip>
  );
};
