import React, { FC, useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Modal, logger } from '@percona/platform-core';
import { Messages } from './UpdateDBClusterModal.messages';
import { UpdateDBClusterModalProps } from './UpdateDBClusterModal.types';
import { getStyles } from './UpdateDBClusterModal.styles';
import { formatDBClusterVersionWithBuild, newDBClusterService } from '../DBCluster.utils';

const { title, confirm, cancel, buildUpdateDatabaseMessage } = Messages;

export const UpdateDBClusterModal: FC<UpdateDBClusterModalProps> = ({
  dbCluster,
  isVisible,
  setVisible,
  setLoading,
  onUpdateFinished,
}) => {
  const styles = useStyles(getStyles);
  const { clusterName, databaseType, installedImage, availableImage } = dbCluster;

  const update = useCallback(async () => {
    try {
      setLoading(true);
      onClose();
      const dbClusterService = newDBClusterService(dbCluster?.databaseType);

      await dbClusterService.updateDBCluster({ ...dbCluster, databaseImage: availableImage });
      onUpdateFinished();
    } catch (e) {
      setLoading(false);
      logger.error(e);
    }
  }, [dbCluster, onUpdateFinished]);

  const onClose = useCallback(() => setVisible(false), [setVisible]);

  return (
    <div className={styles.modalWrapper}>
      <Modal title={title} isVisible={isVisible} onClose={onClose}>
        <h4 data-testid="update-dbcluster-message" className={styles.updateModalContent}>
          {buildUpdateDatabaseMessage(
            databaseType,
            <span className={styles.highlight}>{formatDBClusterVersionWithBuild(installedImage)}</span>,
            <span className={styles.highlight}>{formatDBClusterVersionWithBuild(availableImage)}</span>,
            <span className={styles.highlight}>{clusterName}</span>
          )}
        </h4>
        <HorizontalGroup justify="space-between" spacing="md">
          <Button variant="secondary" size="md" onClick={onClose} data-testid="cancel-update-dbcluster-button">
            {cancel}
          </Button>
          <Button size="md" onClick={update} data-testid="confirm-update-dbcluster-button">
            {confirm}
          </Button>
        </HorizontalGroup>
      </Modal>
    </div>
  );
};
