import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';
import { getStyles } from './LogLine';
import { LogListModel } from './processing';

interface Props {
  log: LogListModel;
  syntaxHighlighting: boolean;
}

export const LogLineDetailsLog = memo(({ log: originalLog, syntaxHighlighting }: Props) => {
  const logStyles = useStyles2(getStyles);
  const log = useMemo(() => {
    const log = originalLog.clone();
    return log;
  }, [originalLog]);

  return (
    <div className={styles.logLineWrapper}>
      {!syntaxHighlighting ? (
        <div className="field no-highlighting">{log.body}</div>
      ) : (
        <div className={logStyles.logLine}>
          <div className={logStyles.wrappedLogLine}>
            <div className="field log-syntax-highlight">{<HighlightedLogRenderer log={log} />}</div>
          </div>
        </div>
      )}
    </div>
  );
});

LogLineDetailsLog.displayName = 'LogLineDetailsLog';

const styles = {
  logLineWrapper: css({
    maxHeight: '50vh',
    overflow: 'auto',
  }),
};
