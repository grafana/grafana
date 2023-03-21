import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, Labels } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

// Levels are already encoded in color, filename is a Loki-ism
const HIDDEN_LABELS = ['level', 'lvl', 'filename'];

interface Props {
  labels: Labels;
}

/** @deprecated will be removed in the next major version */
export const LogLabels = ({ labels }: Props) => {
  const styles = useStyles2(getStyles);
  const displayLabels = Object.keys(labels).filter((label) => !label.startsWith('_') && !HIDDEN_LABELS.includes(label));

  if (displayLabels.length === 0) {
    return (
      <span className={cx([styles.logsLabels])}>
        <span className={cx([styles.logsLabel])}>(no unique labels)</span>
      </span>
    );
  }

  return (
    <span className={cx([styles.logsLabels])}>
      {displayLabels.sort().map((label) => {
        const value = labels[label];
        if (!value) {
          return;
        }
        const tooltip = `${label}: ${value}`;
        return (
          <span key={label} className={cx([styles.logsLabel])}>
            <span className={cx([styles.logsLabelValue])} title={tooltip}>
              {value}
            </span>
          </span>
        );
      })}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logsLabels: css`
      display: flex;
      flex-wrap: wrap;
      font-size: ${theme.typography.size.xs};
    `,
    logsLabel: css`
      label: logs-label;
      display: flex;
      padding: 0 2px;
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius(1)};
      margin: 1px 4px 0 0;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
    logsLabelValue: css`
      label: logs-label__value;
      display: inline-block;
      max-width: 20em;
      text-overflow: ellipsis;
      overflow: hidden;
    `,
  };
};
