import React from 'react';
import classNames from 'classnames';
import { css } from 'emotion';

import { Tooltip, useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    noRightBorderStyle: css`
      label: noRightBorderStyle;
      border-right: 0;
    `,
    /*
     * Required top-padding, otherwise is fa-link icon in active state
     * cut off on top due to fontAwesome icon position
     */
    topPadding: css`
      label: topPadding;
      padding-top: 1px;
    `,
  };
});

interface TimeSyncButtonProps {
  isSynced: boolean;
  onClick: () => void;
}

export function TimeSyncButton(props: TimeSyncButtonProps) {
  const { onClick, isSynced } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  const syncTimesTooltip = () => {
    const { isSynced } = props;
    const tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
    return <>{tooltip}</>;
  };

  return (
    <Tooltip content={syncTimesTooltip} placement="bottom">
      <button
        className={classNames('btn navbar-button navbar-button--attached', {
          [`explore-active-button`]: isSynced,
        })}
        aria-label={isSynced ? 'Synced times' : 'Unsynced times'}
        onClick={() => onClick()}
      >
        <i className={classNames('fa fa-link', styles.topPadding, isSynced && 'icon-brand-gradient')} />
      </button>
    </Tooltip>
  );
}
