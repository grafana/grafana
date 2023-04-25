import React, { FC, useCallback, useEffect, useState } from 'react';

import { ClipboardButton, useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';

import { BackupLogChunk } from '../../Backup.types';
import { useRecurringCall } from '../../hooks/recurringCall.hook';

import { LIMIT, LOGS_CANCEL_TOKEN, STREAM_INTERVAL } from './ChunkedLogsViewer.constants';
import { Messages } from './ChunkedLogsViewer.messages';
import { getStyles } from './ChunkedLogsViewer.styles';
import { ChunkedLogsViewerProps } from './ChunkedLogsViewer.types';

export const ChunkedLogsViewer: FC<ChunkedLogsViewerProps> = ({ getLogChunks }) => {
  const [lastLog, setLastLog] = useState(false);
  const [logs, setLogs] = useState<BackupLogChunk[]>([]);
  const [triggerTimeout, , stopTimeout] = useRecurringCall();
  const [generateToken] = useCancelToken();
  const styles = useStyles(getStyles);

  const formatLogs = useCallback(
    () => logs.map((log) => log.data).reduce((acc, message) => `${acc}${acc.length ? '\n' : ''}${message}`, ''),
    [logs]
  );

  const refreshCurrentLogs = async () => {
    try {
      const { logs: newLogs = [], end } = await getLogChunks(logs[0]?.id || 0, LIMIT, generateToken(LOGS_CANCEL_TOKEN));

      if (end && !lastLog) {
        stopTimeout();
      }

      setLogs(newLogs);
      setLastLog(!!end);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
  };

  useEffect(() => {
    triggerTimeout(refreshCurrentLogs, STREAM_INTERVAL, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ClipboardButton variant="secondary" getText={formatLogs} className={styles.copyBtnHolder}>
        {Messages.copyToClipboard}
      </ClipboardButton>
      <pre>
        {formatLogs()}
        {!lastLog && <div className={styles.loadingHolder}>{Messages.loading}</div>}
        {lastLog && !logs.length && Messages.noLogs}
      </pre>
    </>
  );
};
