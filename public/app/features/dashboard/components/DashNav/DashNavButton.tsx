// Libraries
import React, { FunctionComponent } from 'react';
// Components
import { Tooltip, Icon, IconName, IconType } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

interface Props {
  icon: IconName;
  tooltip: string;
  classSuffix: string;
  onClick?: () => void;
  href?: string;
  iconType?: IconType;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, iconType, tooltip, classSuffix, onClick, href }) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip}>
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={e2e.pages.Dashboard.Toolbar.selectors.toolbarItems(tooltip)}
        >
          <Icon name={icon} type={iconType} />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip}>
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        <Icon name={icon} type={iconType} />
      </a>
    </Tooltip>
  );
};
