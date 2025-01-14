import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { ProcessedLogModel } from './processing';

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
