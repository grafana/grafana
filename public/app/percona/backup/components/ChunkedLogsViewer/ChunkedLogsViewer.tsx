import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import React, { FC, useState, useEffect, useCallback } from 'react';
import { BackupLogChunk } from '../../Backup.types';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { LIMIT, STREAM_INTERVAL, LOGS_CANCEL_TOKEN } from './ChunkedLogsViewer.constants';
import { getStyles } from './ChunkedLogsViewer.styles';
import { ChunkedLogsViewerProps } from './ChunkedLogsViewer.types';
import { Messages } from './ChunkedLogsViewer.messages';
import { isApiCancelError } from 'app/percona/shared/helpers/api';

export const ChunkedLogsViewer: FC<ChunkedLogsViewerProps> = ({ getLogChunks }) => {
  const [lastLog, setLastLog] = useState(false);
  const [logs, setLogs] = useState<BackupLogChunk[]>([]);
  const [triggerTimeout, , stopTimeout] = useRecurringCall();
  const [generateToken] = useCancelToken();
  const styles = useStyles(getStyles);

  const refreshCurrentLogs = async () => {
    try {
      const { logs: newLogs = [], end } = await getLogChunks(logs[0]?.id || 0, LIMIT, generateToken(LOGS_CANCEL_TOKEN));
      setLogs(newLogs);
      setLastLog(!!end);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
  };

  const formatLogs = useCallback(
    () => logs.map((log) => log.data).reduce((acc, message) => `${acc}${acc.length ? '\n' : ''}${message}`, ''),
    [logs]
  );

  useEffect(() => {
    triggerTimeout(refreshCurrentLogs, STREAM_INTERVAL, true);
  }, []);

  useEffect(() => {
    if (lastLog) {
      stopTimeout();
    }
  }, [lastLog]);

  return (
    <>
      <CopyToClipboard text={formatLogs} elType="span" className={styles.copyBtnHolder}>
        <Button variant="secondary">{Messages.copyToClipboard}</Button>
      </CopyToClipboard>
      <pre>
        {formatLogs()}
        {!lastLog && <div className={styles.loadingHolder}>{Messages.loading}</div>}
        {lastLog && !logs.length && Messages.noLogs}
      </pre>
    </>
  );
};
