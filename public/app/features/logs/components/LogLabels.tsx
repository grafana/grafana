import { css, cx } from '@emotion/css';
import { memo, forwardRef, useMemo } from 'react';

import { GrafanaTheme2, Labels } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

// Levels are already encoded in color, filename is a Loki-ism
const HIDDEN_LABELS = ['level', 'lvl', 'filename'];

interface Props {
  labels: Labels;
  emptyMessage?: string;
}

export const LogLabels = memo(({ labels, emptyMessage }: Props) => {
  const styles = useStyles2(getStyles);
  const displayLabels = useMemo(
    () =>
      Object.keys(labels)
        .filter((label) => !label.startsWith('_') && !HIDDEN_LABELS.includes(label))
        .sort(),
    [labels]
  );

  if (displayLabels.length === 0 && emptyMessage) {
    return (
      <span className={cx([styles.logsLabels])}>
        <span className={cx([styles.logsLabel])}>{emptyMessage}</span>
      </span>
    );
  }

  return (
    <span className={cx([styles.logsLabels])}>
      {displayLabels.map((label) => {
        const value = labels[label];
        if (!value) {
          return;
        }
        const labelValue = `${label}=${value}`;
        return (
          <Tooltip content={labelValue} key={label} placement="top">
            <LogLabel styles={styles}>{labelValue}</LogLabel>
          </Tooltip>
        );
      })}
    </span>
  );
});
LogLabels.displayName = 'LogLabels';

interface LogLabelsArrayProps {
  labels: string[];
}

export const LogLabelsList = memo(({ labels }: LogLabelsArrayProps) => {
  const styles = useStyles2(getStyles);
  return (
    <span className={cx([styles.logsLabels])}>
      {labels.map((label) => (
        <LogLabel key={label} styles={styles} tooltip={label}>
          {label}
        </LogLabel>
      ))}
    </span>
  );
});
LogLabelsList.displayName = 'LogLabelsList';

interface LogLabelProps {
  styles: Record<string, string>;
  tooltip?: string;
  children: JSX.Element | string;
}

const LogLabel = forwardRef<HTMLSpanElement, LogLabelProps>(({ styles, tooltip, children }: LogLabelProps, ref) => {
  return (
    <span className={cx([styles.logsLabel])} ref={ref}>
      <span className={cx([styles.logsLabelValue])} title={tooltip}>
        {children}
      </span>
    </span>
  );
});
LogLabel.displayName = 'LogLabel';

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
      padding: ${theme.spacing(0, 0.25)};
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      margin: ${theme.spacing(0.125, 0.5, 0, 0)};
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
    logsLabelValue: css`
      label: logs-label__value;
      display: inline-block;
      max-width: ${theme.spacing(25)};
      text-overflow: ellipsis;
      overflow: hidden;
    `,
  };
};
