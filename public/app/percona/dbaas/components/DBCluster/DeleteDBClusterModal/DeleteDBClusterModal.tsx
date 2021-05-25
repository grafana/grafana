import React, { FC, useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Modal, logger } from '@percona/platform-core';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { DeleteDBClusterModalProps } from './DeleteDBClusterModal.types';
import { getStyles } from './DeleteDBClusterModal.styles';
import { newDBClusterService } from '../DBCluster.utils';

export const DeleteDBClusterModal: FC<DeleteDBClusterModalProps> = ({
  isVisible,
  setVisible,
  setLoading,
  onClusterDeleted,
  selectedCluster,
}) => {
  const styles = useStyles(getStyles);

  const deleteDBCluster = useCallback(async () => {
    if (!selectedCluster) {
      setVisible(false);

      return;
    }

    try {
      setLoading(true);
      setVisible(false);
      const dbClusterService = newDBClusterService(selectedCluster?.databaseType);

      await dbClusterService.deleteDBClusters(selectedCluster);
      onClusterDeleted();
    } catch (e) {
      setLoading(false);
      logger.error(e);
    }
  }, [selectedCluster]);

  const ConfirmationMessage = () =>
    selectedCluster ? (
      <h4 className={styles.deleteModalContent}>
        Are you sure that you want to delete
        {` ${DATABASE_LABELS[selectedCluster.databaseType]} `}
        cluster
        <span className={styles.namesHighlight}>{` ${selectedCluster.clusterName} `}</span>
        from Kubernetes cluster
        <span className={styles.namesHighlight}>{` ${selectedCluster.kubernetesClusterName} `}</span>?
      </h4>
    ) : null;

  return (
    <Modal title={Messages.dbcluster.deleteModal.title} isVisible={isVisible} onClose={() => setVisible(false)}>
      <ConfirmationMessage />
      <HorizontalGroup justify="space-between" spacing="md">
        <Button
          variant="secondary"
          size="md"
          onClick={() => setVisible(false)}
          data-qa="cancel-delete-dbcluster-button"
        >
          {Messages.dbcluster.deleteModal.cancel}
        </Button>
        <Button variant="destructive" size="md" onClick={deleteDBCluster} data-qa="delete-dbcluster-button">
          {Messages.dbcluster.deleteModal.confirm}
        </Button>
      </HorizontalGroup>
    </Modal>
  );
};
