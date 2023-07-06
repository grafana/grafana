import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { clearButtonStyles, Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  /** Expand or collapse te content */
  isOpen?: boolean;
  /** Element or text for the Collapse header */
  label: React.ReactNode;
  /** Indicates loading state of the content */
  loading?: boolean;
  /** Toggle collapsed header icon */
  collapsible?: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  /** Additional class name for the root element */
  className?: string;
}

export function SettingsConfiguration({
  isOpen,
  label,
  loading,
  collapsible,
  onToggle,
  className,
  children,
}: React.PropsWithChildren<Props>) {
  const buttonStyles = useStyles2(clearButtonStyles);
  const style = useStyles2(getStyles);

  const onClickToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const panelClass = cx([style.collapse, className]);
  const loaderClass = loading ? cx([style.loader, style.loaderActive]) : cx([style.loader]);
  const headerClass = collapsible ? cx([style.header]) : cx([style.headerCollapsed]);

  return (
    <div className={panelClass}>
      <button type="button" className={cx(buttonStyles, headerClass)} onClick={onClickToggle}>
        {collapsible && <Icon className={style.icon} name={isOpen ? 'angle-down' : 'angle-right'} />}
        <div className={cx([style.headerLabel])}>{label}</div>
      </button>
      {isOpen && (
        <div className={cx([style.collapseBody])}>
          <div className={loaderClass} />
          <div className={style.bodyContentWrapper}>{children}</div>
        </div>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    collapse: css({}),
    collapseHeader: css({}),
    collapseBody: css({}),
  };
}
