import React, { FunctionComponent, useContext } from 'react';
import { css, cx } from 'emotion';
import { Labels, LogRowModel } from '@grafana/data';

import { LogLabel } from './LogLabel';
import { GrafanaTheme } from '../../types/theme';
import { ThemeContext } from '../../themes/ThemeContext';

const getStyles = (theme: GrafanaTheme) => ({
  logsLabels: css`
    display: flex;
    flex-wrap: wrap;
  `,
});

interface Props {
  labels: Labels;
  getRows: () => LogRowModel[];
  plain?: boolean;
  onClickLabel?: (label: string, value: string) => void;
}

export const LogLabels: FunctionComponent<Props> = ({ getRows, labels, onClickLabel, plain }) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <span className={cx([styles.logsLabels])}>
      {Object.keys(labels).map(key => (
        <LogLabel
          key={key}
          getRows={getRows}
          label={key}
          value={labels[key]}
          plain={plain}
          onClickLabel={onClickLabel}
        />
      ))}
    </span>
  );
};

LogLabels.displayName = 'LogLabels';
