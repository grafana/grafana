import React, { FC, useCallback } from 'react';

import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { logger } from 'app/percona/shared/helpers/logger';

import { formatDBClusterVersionWithBuild, newDBClusterService } from '../DBCluster.utils';

import { Messages } from './UpdateDBClusterModal.messages';
import { getStyles } from './UpdateDBClusterModal.styles';
import { UpdateDBClusterModalProps } from './UpdateDBClusterModal.types';

const { title, confirm, cancel, buildUpdateDatabaseMessage } = Messages;

export const UpdateDBClusterModal: FC<React.PropsWithChildren<UpdateDBClusterModalProps>> = ({
  dbCluster,
  isVisible,
  setVisible,
  setLoading,
  onUpdateFinished,
}) => {
  const styles = useStyles(getStyles);
  const { clusterName, databaseType, installedImage, availableImage } = dbCluster;

  const onClose = useCallback(() => setVisible(false), [setVisible]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbCluster, onUpdateFinished]);

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
