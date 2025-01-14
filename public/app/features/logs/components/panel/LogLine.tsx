import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2, LogRowModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { ProcessedLogModel } from './processing';
import { measureText } from './virtualization';

interface Props {
  log: ProcessedLogModel;
  style: CSSProperties;
  wrapLogMessage: boolean;
}

export const LogLine = ({ log, style, wrapLogMessage }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  let optionStyles = '';
  if (!wrapLogMessage) {
    optionStyles += ` ${styles.unwrappedLogLine}`;
  }

  return (
    <div style={style} className={`${styles.logLine}${optionStyles}`}>
      {log.body}
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
  unwrappedLogLine: css({
    whiteSpace: 'pre',
  }),
});

export function getLogLineSize(
  logs: ProcessedLogModel[],
  container: HTMLDivElement | null,
  theme: GrafanaTheme2,
  wrapLogMessage: boolean,
  index: number
) {
  if (!container) {
    return 0;
  }
  const lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
  if (!wrapLogMessage) {
    return lineHeight;
  }
  const { height } = measureText(logs[index].body, container.clientWidth, lineHeight);
  return height;
}
