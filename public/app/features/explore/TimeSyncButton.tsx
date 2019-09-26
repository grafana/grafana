import React from 'react';
import classNames from 'classnames';
import { css } from 'emotion';
import memoizeOne from 'memoize-one';

import { GrafanaTheme, useTheme } from '@grafana/ui';

//Components
import { Tooltip } from '@grafana/ui';

const getStyles = memoizeOne((theme: GrafanaTheme) => {
  return {
    timePickerSynced: css`
      label: timePickerSynced;
      border-color: ${theme.colors.orangeDark};
      background-image: none;
      background-color: transparent;
      color: ${theme.colors.orangeDark};
      &:focus,
      :hover {
        color: ${theme.colors.orangeDark};
        background-image: none;
        background-color: transparent;
      }
    `,
    noRightBorderStyle: css`
      label: noRightBorderStyle;
      border-right: 0;
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
    return <>Sync all views to this time range</>;
  };

  return (
    <Tooltip content={syncTimesTooltip} placement="bottom">
      <button
        className={classNames('btn navbar-button navbar-button--attached', {
          [styles.timePickerSynced]: isSynced,
        })}
        onClick={() => onClick()}
      >
        <i className="fa fa-link" />
      </button>
    </Tooltip>
  );
}
