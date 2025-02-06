import { css } from '@emotion/css';
import { CSSProperties, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { ProcessedLogModel } from './processing';
import { hasUnderOrOverflow } from './virtualization';

interface Props {
  index: number;
  log: ProcessedLogModel;
  showTime: boolean;
  style: CSSProperties;
  onOverflow?: (index: number, id: string, height: number) => void;
  wrapLogMessage: boolean;
}

export const LogLine = ({ index, log, style, onOverflow, showTime, wrapLogMessage }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
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
    <div style={style} className={styles.logLine} ref={onOverflow ? logLineRef : undefined}>
      <div className={wrapLogMessage ? styles.wrappedLogLine : styles.unwrappedLogLine}>
        {showTime && <span className={`${styles.timestamp} level-${log.logLevel}`}>{log.timestamp}</span>}
        {log.logLevel && <span className={`${styles.level} level-${log.logLevel}`}>{log.logLevel}</span>}
        {log.body}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
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
        opacity: 0.9,
      },
    }),
    timestamp: css({
      color: theme.colors.text.secondary,
      display: 'inline-block',
      marginRight: theme.spacing(1),
      '&.level-critical': {
        color: colors.critical,
      },
      '&.level-error': {
        color: colors.error,
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
      marginRight: theme.spacing(1),
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
    overflows: css({
      outline: 'solid 1px red',
    }),
    unwrappedLogLine: css({
      whiteSpace: 'pre',
      paddingBottom: theme.spacing(0.5),
    }),
    wrappedLogLine: css({
      whiteSpace: 'pre-wrap',
      paddingBottom: theme.spacing(0.5),
    }),
  };
};
