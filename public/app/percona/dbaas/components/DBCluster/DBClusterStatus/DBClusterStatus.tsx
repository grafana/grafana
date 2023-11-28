/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';

import { Icon, useStyles2, Tooltip, Badge, BadgeColor } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { ProgressBar } from 'app/percona/dbaas/components/ProgressBar/ProgressBar';
import { ProgressBarStatus } from 'app/percona/dbaas/components/ProgressBar/ProgressBar.types';
import { useDispatch } from 'app/types';

import { selectDBCluster } from '../../../../shared/core/reducers/dbaas/dbaas';
import { getStyles as getStatusStyles } from '../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/OperatorStatus/OperatorStatus.styles';
import { DBClusterStatus as Status, DBClusterStatusColors } from '../DBCluster.types';

import { COMPLETE_PROGRESS_DELAY, STATUS_DATA_QA } from './DBClusterStatus.constants';
import { getStyles } from './DBClusterStatus.styles';
import { DBClusterStatusProps } from './DBClusterStatus.types';
import { getProgressMessage, getShowProgressBarValue } from './DBClusterStatus.utils';

export const DBClusterStatus: FC<React.PropsWithChildren<DBClusterStatusProps>> = ({ dbCluster, setLogsModalVisible }) => {
  const dispatch = useDispatch();
  const { message, finishedSteps, totalSteps } = dbCluster;
  const status = dbCluster.status || Status.unknown;
  const styles = useStyles2(getStyles);
  const statusStyles = useStyles2(getStatusStyles);
  const prevStatus = useRef<Status>();
  const statusError = status === Status.failed || status === Status.invalid;
  const showMessage =
    message &&
    (statusError ||
      status === Status.changing ||
      status === Status.deleting ||
      status === Status.unknown ||
      status === Status.upgrading);
  const [showProgressBar, setShowProgressBar] = useState(getShowProgressBarValue(status, prevStatus.current));

  const statusColor: BadgeColor = DBClusterStatusColors[status];
  const ErrorMessage = useMemo(
    () => () => <pre>{message ? message.replace(/;/g, '\n') : Messages.dbcluster.table.status.errorMessage}</pre>,
    [message]
  );
  const openLogs = () => {
    dispatch(selectDBCluster(null));
    setLogsModalVisible(true);
  };

  useEffect(() => {
    // handles the last step of the progress bar
    // creates a delay between the last step and showing active status
    // without this the bar would jump from the second last step to active status
    if (prevStatus.current === Status.changing && status === Status.ready) {
      setTimeout(() => setShowProgressBar(false), COMPLETE_PROGRESS_DELAY);
    } else {
      setShowProgressBar(getShowProgressBarValue(status, prevStatus.current));
    }
  }, [status]);

  useEffect(() => {
    prevStatus.current = status;
  });

  return (
    <div className={cx(styles.clusterStatusWrapper, { [styles.clusterPillWrapper]: !showProgressBar })}>
      {showProgressBar ? (
        <ProgressBar
          status={statusError ? ProgressBarStatus.error : ProgressBarStatus.progress}
          finishedSteps={finishedSteps || 0}
          totalSteps={totalSteps || 0}
          message={getProgressMessage(status, prevStatus.current)}
          dataTestId="cluster-progress-bar"
        />
      ) : (
        <Badge
          text={Messages.dbcluster.table.status[status]}
          color={statusColor}
          data-testid={`cluster-status-${STATUS_DATA_QA[status]}`}
          className={status === Status.unknown ? statusStyles.wrapperGrey : undefined}
        />
      )}
      {showMessage && showProgressBar && (
        <div className={styles.logsWrapper}>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events */}
          <a className={styles.logsLabel} onClick={() => openLogs()}>
            {Messages.dbcluster.table.status.logs}
          </a>
          <Tooltip content={<ErrorMessage />} placement="bottom">
            <span className={cx(styles.statusIcon)} data-testid="cluster-status-error-message">
              <Icon name="info-circle" />
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
