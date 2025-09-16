import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';

import { LogMessageAnsi } from '../LogMessageAnsi';

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
      <div className={logStyles.logLine}>
        <div className={logStyles.wrappedLogLine}>
          {log.hasAnsi ? (
            <span className="field no-highlighting">
              <LogMessageAnsi value={log.body} />
            </span>
          ) : (
            <>
              {!syntaxHighlighting && <div className="field no-highlighting">{log.body}</div>}
              {syntaxHighlighting && (
                <div className="field log-syntax-highlight">{<HighlightedLogRenderer log={log} />}</div>
              )}
            </>
          )}
        </div>
      </div>
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
