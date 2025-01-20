import { css } from '@emotion/css';
import { CSSProperties, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { ProcessedLogModel } from './processing';

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
    const hasOverflow = logLineRef.current.scrollHeight > logLineRef.current.clientHeight;
    if (hasOverflow) {
      onOverflow(index, log.uid, logLineRef.current.scrollHeight);
    }
  }, [index, log.body, log.uid, onOverflow]);

  return (
    <div style={style} className={styles.logLine} ref={onOverflow ? logLineRef : undefined}>
      <div className={wrapLogMessage ? styles.wrappedLogLine : styles.unwrappedLogLine}>
        {showTime && <span className={styles.timestamp}>{log.timestamp}</span>}
        {log.logLevel && <span className={styles.level}>{log.logLevel}</span>}
        {log.body}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  logLine: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.fontSize,
    wordBreak: 'break-all',
    '&:hover': {
      opacity: 0.5,
    },
  }),
  timestamp: css({
    display: 'inline-block',
    marginRight: theme.spacing(1),
  }),
  level: css({
    display: 'inline-block',
    marginRight: theme.spacing(1),
  }),
  overflows: css({
    outline: 'solid 1px red',
  }),
  unwrappedLogLine: css({
    whiteSpace: 'pre',
  }),
  wrappedLogLine: css({
    whiteSpace: 'pre-wrap',
  }),
});
