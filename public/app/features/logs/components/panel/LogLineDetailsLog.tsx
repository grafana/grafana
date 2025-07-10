import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './LogLine';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  log: LogListModel;
}

export const LogLineDetailsLog = memo(({ log: originalLog }: Props) => {
  const { syntaxHighlighting } = useLogListContext();
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
            <div className="field log-syntax-highlight" dangerouslySetInnerHTML={{ __html: log.highlightedBody }} />
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
