import { css } from '@emotion/css';
import { CSSProperties, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { ProcessedLogModel } from './processing';

interface Props {
  log: ProcessedLogModel;
  style: CSSProperties;
  wrapLogMessage: boolean;
  onOverflow?: (height: number) => void;
}

export const LogLine = ({ log, style, onOverflow, wrapLogMessage }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const logLineRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (!onOverflow || !logLineRef.current) {
      return;
    }
    const hasOverflow = logLineRef.current.scrollHeight > logLineRef.current.clientHeight;
    if (hasOverflow) {
      onOverflow(logLineRef.current.scrollHeight);
      setOverflows(true);
    }
  }, [log.body, onOverflow]);

  let optionStyles = '';
  if (overflows) {
    optionStyles += ` ${styles.overflows}`;
  }

  return (
    <div style={style} className={`${styles.logLine}${optionStyles}`} ref={onOverflow ? logLineRef : undefined}>
      <div className={wrapLogMessage ? styles.wrappedLogLine : styles.unwrappedLogLine}>
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
