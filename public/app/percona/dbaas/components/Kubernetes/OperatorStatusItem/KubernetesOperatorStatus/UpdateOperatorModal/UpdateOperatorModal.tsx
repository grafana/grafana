import React, { FC, useCallback } from 'react';

import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { instalKuberneteslOperatorAction } from 'app/percona/shared/core/reducers';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch } from 'app/types';

import { getStyles } from './UpdateOperatorModal.styles';
import { UpdateOperatorModalProps } from './UpdateOperatorModal.types';

const { title, confirm, cancel, buildUpdateOperatorMessage } = Messages.kubernetes.updateOperatorModal;

export const UpdateOperatorModal: FC<UpdateOperatorModalProps> = ({
  kubernetesClusterName,
  selectedOperator,
  isVisible,
  setVisible,
  setSelectedCluster,
  setOperatorToUpdate,
}) => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const { operatorType, operatorTypeLabel, version, availableVersion } = selectedOperator;

  const onClose = useCallback(() => {
    setVisible(false);
    setSelectedCluster(null);
    setOperatorToUpdate(null);
  }, [setVisible, setSelectedCluster, setOperatorToUpdate]);

  const updateOperator = useCallback(async () => {
    try {
      onClose();
      dispatch(
        instalKuberneteslOperatorAction({
          kubernetesClusterName,
          operatorType,
          availableVersion: availableVersion || '',
        })
      );
    } catch (e) {
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kubernetesClusterName, selectedOperator]);

  return (
    <div className={styles.modalWrapper}>
      <Modal title={title} isVisible={isVisible} onClose={onClose}>
        <h4 data-testid="update-operator-message" className={styles.updateModalContent}>
          {buildUpdateOperatorMessage(
            operatorTypeLabel,
            <span className={styles.versionHighlight}>{availableVersion}</span>,
            <span className={styles.versionHighlight}>{kubernetesClusterName}</span>,
            version
          )}
        </h4>
        <HorizontalGroup justify="space-between" spacing="md">
          <Button variant="secondary" size="md" onClick={onClose} data-testid="cancel-update-operator-button">
            {cancel}
          </Button>
          <Button size="md" onClick={updateOperator} data-testid="confirm-update-operator-button">
            {confirm}
          </Button>
        </HorizontalGroup>
      </Modal>
    </div>
  );
};
