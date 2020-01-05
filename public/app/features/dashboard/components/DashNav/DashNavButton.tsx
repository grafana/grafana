// Libraries
import React, { FunctionComponent } from 'react';
// Components
import { Tooltip } from '@grafana/ui';
import { e2e } from '@grafana/e2e';
import { Unicon } from '@grafana/ui/src/components/Icon/Unicon';

interface Props {
  icon: string;
  tooltip: string;
  classSuffix: string;
  onClick?: () => void;
  href?: string;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, tooltip, classSuffix, onClick, href }) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip}>
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={e2e.pages.Dashboard.Toolbar.selectors.toolbarItems(tooltip)}
        >
          <Unicon name={icon} />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip}>
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        <Unicon name={icon} />
      </a>
    </Tooltip>
  );
};
