import React, { FC, useEffect, useState } from 'react';

import { Button, Icon, Spinner, useStyles } from '@grafana/ui';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { logger } from 'app/percona/shared/helpers/logger';

import { DBClusterService } from '../DBCluster.service';
import { DBClusterLogs } from '../DBCluster.types';

import { Messages } from './DBClusterLogsModal.messages';
import { getStyles } from './DBClusterLogsModal.styles';
import { DBClusterLogsModalProps } from './DBClusterLogsModal.types';
import { toggleLogs, transformLogs } from './DBClusterLogsModal.utils';
import { PodLogs } from './PodLogs/PodLogs';

export const DBClusterLogsModal: FC<DBClusterLogsModalProps> = ({ dbCluster, isVisible, setVisible }) => {
  const styles = useStyles(getStyles);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DBClusterLogs>({ pods: [] });
  const [expanded, setExpanded] = useState(false);
  const getClusterLogs = async () => {
    if (!dbCluster) {
      return;
    }

    try {
      setLoading(true);
      setLogs(transformLogs(await DBClusterService.getLogs(dbCluster), logs));
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = () => {
    setLogs({ pods: toggleLogs(logs.pods, !expanded) });
    setExpanded((currentValue) => !currentValue);
  };
  const refresh = () => {
    getClusterLogs();
    setExpanded(false);
  };

  useEffect(() => {
    getClusterLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbCluster]);

  useEffect(() => {
    setExpanded(false);
  }, [isVisible]);

  return (
    <div className={styles.modal}>
      <Modal title={Messages.title} isVisible={isVisible} onClose={() => setVisible(false)}>
        <div className={styles.modalWrapper}>
          {loading ? (
            <div data-testid="dbcluster-logs-loading" className={styles.spinnerWrapper}>
              <Spinner />
            </div>
          ) : (
            <>
              {!logs || logs.pods.length <= 0 ? (
                <span data-testid="dbcluster-no-logs">{Messages.noLogs}</span>
              ) : (
                <>
                  <div data-testid="dbcluster-logs-actions" className={styles.header}>
                    <span className={styles.podsLabel}>{Messages.pods}</span>
                    <Button variant="secondary" onClick={() => toggleCollapse()} className={styles.expandButton}>
                      {expanded ? Messages.collapse : Messages.expand}
                    </Button>
                    <Button variant="secondary" onClick={() => refresh()}>
                      <Icon name="sync" />
                    </Button>
                  </div>
                  {logs.pods.map((pod) => (
                    <PodLogs key={`${pod.name}${pod.isOpen}`} podLogs={pod} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
