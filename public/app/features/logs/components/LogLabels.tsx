import { css, cx } from '@emotion/css';
import { memo, forwardRef, useMemo } from 'react';

import { GrafanaTheme2, Labels } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from './LogDetailsBody';

// Levels are already encoded in color, filename is a Loki-ism
const HIDDEN_LABELS = ['detected_level', 'level', 'lvl', 'filename'];

interface Props {
  labels: Labels;
  emptyMessage?: string;
  addTooltip?: boolean;
}

export const LogLabels = memo(({ labels, emptyMessage, addTooltip = true }: Props) => {
  const styles = useStyles2(getStyles);
  const displayLabels = useMemo(
    () =>
      Object.keys(labels)
        .filter((label) => !label.startsWith('_') && !HIDDEN_LABELS.includes(label) && labels[label])
        .map((label) => `${label}=${labels[label]}`),
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
      {displayLabels.map((labelValue) => {
        return addTooltip ? (
          <Tooltip content={labelValue} key={labelValue} placement="top">
            <LogLabel styles={styles}>{labelValue}</LogLabel>
          </Tooltip>
        ) : (
          <LogLabel styles={styles} tooltip={labelValue} key={labelValue}>
            {labelValue}
          </LogLabel>
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
          {label === LOG_LINE_BODY_FIELD_NAME ? 'log line' : label}
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
    logsLabels: css({
      display: 'flex',
      flexWrap: 'wrap',
      fontSize: theme.typography.size.xs,
    }),
    logsLabel: css({
      label: 'logs-label',
      display: 'flex',
      padding: theme.spacing(0, 0.25),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0.125, 0.5, 0, 0),
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    }),
    logsLabelValue: css({
      label: 'logs-label__value',
      display: 'inline-block',
      maxWidth: theme.spacing(25),
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
  };
};
