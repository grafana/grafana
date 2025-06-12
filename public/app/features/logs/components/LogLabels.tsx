import { css } from '@emotion/css';
import { memo, forwardRef, useMemo, useState } from 'react';

import { GrafanaTheme2, Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from './LogDetailsBody';

// Levels are already encoded in color, filename is a Loki-ism
const HIDDEN_LABELS = ['detected_level', 'level', 'lvl', 'filename'];

export interface Props {
  labels: Labels;
  emptyMessage?: string;
  addTooltip?: boolean;
  displayMax?: number;
  displayAll?: boolean;
  onDisplayMaxToggle?(state: boolean): void;
}

export const LogLabels = memo(
  ({
    labels,
    emptyMessage,
    addTooltip = true,
    displayMax,
    onDisplayMaxToggle,
    displayAll: initialDisplayAll = false,
  }: Props) => {
    const [displayAll, setDisplayAll] = useState<boolean | undefined>(displayMax ? initialDisplayAll : undefined);
    const styles = useStyles2(getStyles);
    const allLabels = useMemo(
      () =>
        Object.keys(labels)
          .filter((label) => !label.startsWith('_') && !HIDDEN_LABELS.includes(label) && labels[label])
          .map((label) => `${label}=${labels[label]}`),
      [labels]
    );
    const displayLabels = useMemo(
      () => allLabels.slice(0, !displayAll && displayMax ? displayMax : Infinity),
      [allLabels, displayAll, displayMax]
    );

    if (displayLabels.length === 0 && emptyMessage) {
      return (
        <span className={styles.logsLabels}>
          <span className={styles.logsLabel}>{emptyMessage}</span>
        </span>
      );
    }

    return (
      <span className={styles.logsLabels}>
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
        {displayLabels.length < allLabels.length && !displayAll && (
          <Button
            size="sm"
            fill="outline"
            variant="secondary"
            aria-label={t('logs.log-labels.expand', 'Expand labels')}
            onClick={() => {
              setDisplayAll(true);
              onDisplayMaxToggle?.(true);
            }}
          >
            <Icon name="plus" size="xs" />
            {allLabels.length - displayLabels.length}
          </Button>
        )}
        {displayAll === true && (
          <Button
            size="sm"
            fill="outline"
            variant="secondary"
            aria-label={t('logs.log-labels.collapse', 'Collapse labels')}
            onClick={() => {
              setDisplayAll(false);
              onDisplayMaxToggle?.(false);
            }}
          >
            <Icon name="minus" size="xs" />
          </Button>
        )}
      </span>
    );
  }
);
LogLabels.displayName = 'LogLabels';

interface LogLabelsArrayProps {
  labels: string[];
}

export const LogLabelsList = memo(({ labels }: LogLabelsArrayProps) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.logsLabels}>
      {labels.map((label) => (
        <LogLabel key={label} styles={styles} tooltip={label}>
          {label === LOG_LINE_BODY_FIELD_NAME ? t('logs.log-labels-list.log-line', 'log line') : label}
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
    <span className={styles.logsLabel} ref={ref}>
      <span className={styles.logsLabelValue} title={tooltip}>
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
      alignItems: 'center',
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
      maxHeight: theme.spacing(2),
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
