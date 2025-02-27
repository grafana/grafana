import { css } from '@emotion/css';
import { CSSProperties, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { LogFieldDimension, LogListModel } from './processing';
import { FIELD_GAP_MULTIPLIER, hasUnderOrOverflow } from './virtualization';

interface Props {
  displayedFields: string[];
  index: number;
  log: LogListModel;
  showTime: boolean;
  style: CSSProperties;
  styles: LogLineStyles;
  onOverflow?: (index: number, id: string, height: number) => void;
  variant?: 'infinite-scroll';
  wrapLogMessage: boolean;
}

export const LogLine = ({
  displayedFields,
  index,
  log,
  style,
  styles,
  onOverflow,
  showTime,
  variant,
  wrapLogMessage,
}: Props) => {
  const logLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onOverflow || !logLineRef.current) {
      return;
    }
    const calculatedHeight = typeof style.height === 'number' ? style.height : undefined;
    const actualHeight = hasUnderOrOverflow(logLineRef.current, calculatedHeight);
    if (actualHeight) {
      onOverflow(index, log.uid, actualHeight);
    }
  }, [index, log.uid, onOverflow, style.height]);

  return (
    <div style={style} className={`${styles.logLine} ${variant ?? ''}`} ref={onOverflow ? logLineRef : undefined}>
      <div className={`${wrapLogMessage ? styles.wrappedLogLine : `${styles.unwrappedLogLine} unwrapped-log-line`}`}>
        <Log displayedFields={displayedFields} log={log} showTime={showTime} styles={styles} />
      </div>
    </div>
  );
};

interface LogProps {
  displayedFields: string[];
  log: LogListModel;
  showTime: boolean;
  styles: ReturnType<typeof getStyles>;
}

const Log = ({ displayedFields, log, showTime, styles }: LogProps) => {
  return (
    <>
      {showTime && <span className={`${styles.timestamp} level-${log.logLevel} field`}>{log.timestamp}</span>}
      <span className={`${styles.level} level-${log.logLevel} field`}>{log.displayLevel}</span>
      {displayedFields.length > 0 ? (
        displayedFields.map((field) => (
          <span className="field" title={field}>
            {getDisplayedFieldValue(field, log)}
          </span>
        ))
      ) : (
        <span className="field">{log.body}</span>
      )}
    </>
  );
};

export function getDisplayedFieldValue(fieldName: string, log: LogListModel): string {
  if (fieldName === LOG_LINE_BODY_FIELD_NAME) {
    return log.body;
  }
  if (log.labels[fieldName] != null) {
    return log.labels[fieldName];
  }
  const field = log.fields.find((field) => {
    return field.keys[0] === fieldName;
  });

  return field ? field.values.toString() : '';
}

export function getGridTemplateColumns(dimensions: LogFieldDimension[]) {
  const columns = dimensions.map((dimension) => dimension.width).join('px ');
  return `${columns}px 1fr`;
}

export type LogLineStyles = ReturnType<typeof getStyles>;
export const getStyles = (theme: GrafanaTheme2) => {
  const colors = {
    critical: '#B877D9',
    error: '#FF5286',
    warning: '#FBAD37',
    debug: '#6CCF8E',
    trace: '#6ed0e0',
    info: '#6E9FFF',
  };

  return {
    logLine: css({
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.fontSize,
      wordBreak: 'break-all',
      '&:hover': {
        opacity: 0.7,
      },
      '&.infinite-scroll': {
        '&::before': {
          borderTop: `solid 1px ${theme.colors.border.strong}`,
          content: '""',
          height: 0,
          left: 0,
          position: 'absolute',
          top: -3,
          width: '100%',
        },
      },
    }),
    logLineMessage: css({
      fontFamily: theme.typography.fontFamily,
      textAlign: 'center',
    }),
    timestamp: css({
      color: theme.colors.text.secondary,
      display: 'inline-block',
      '&.level-critical': {
        color: colors.critical,
      },
      '&.level-error': {
        color: colors.error,
      },
      '&.level-info': {
        color: colors.info,
      },
      '&.level-warning': {
        color: colors.warning,
      },
      '&.level-debug': {
        color: colors.debug,
      },
    }),
    level: css({
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightBold,
      display: 'inline-block',
      '&.level-critical': {
        color: colors.critical,
      },
      '&.level-error': {
        color: colors.error,
      },
      '&.level-warning': {
        color: colors.warning,
      },
      '&.level-info': {
        color: colors.info,
      },
      '&.level-debug': {
        color: colors.debug,
      },
    }),
    loadMoreButton: css({
      background: 'transparent',
      border: 'none',
      display: 'inline',
    }),
    overflows: css({
      outline: 'solid 1px red',
    }),
    unwrappedLogLine: css({
      display: 'grid',
      gridColumnGap: theme.spacing(FIELD_GAP_MULTIPLIER),
      whiteSpace: 'pre',
      paddingBottom: theme.spacing(0.75),
    }),
    wrappedLogLine: css({
      whiteSpace: 'pre-wrap',
      paddingBottom: theme.spacing(0.75),
      '& .field': {
        marginRight: theme.spacing(FIELD_GAP_MULTIPLIER),
      },
      '& .field:last-child': {
        marginRight: 0,
      },
    }),
  };
};
