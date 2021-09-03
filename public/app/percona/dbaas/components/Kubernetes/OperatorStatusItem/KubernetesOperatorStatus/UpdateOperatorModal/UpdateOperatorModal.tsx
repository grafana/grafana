import React, { FC, useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Modal, logger } from '@percona/platform-core';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { UpdateOperatorModalProps } from './UpdateOperatorModal.types';
import { getStyles } from './UpdateOperatorModal.styles';
import { KubernetesService } from '../../../Kubernetes.service';

const { title, confirm, cancel, buildUpdateOperatorMessage } = Messages.kubernetes.updateOperatorModal;

export const UpdateOperatorModal: FC<UpdateOperatorModalProps> = ({
  kubernetesClusterName,
  selectedOperator,
  isVisible,
  setVisible,
  setLoading,
  setSelectedCluster,
  setOperatorToUpdate,
  onOperatorUpdated,
}) => {
  const styles = useStyles(getStyles);
  const { operatorType, operatorTypeLabel, version, availableVersion } = selectedOperator;

  const updateOperator = useCallback(async () => {
    try {
      setLoading(true);
      onClose();

      await KubernetesService.installOperator(kubernetesClusterName, operatorType, availableVersion as string);
      onOperatorUpdated();
    } catch (e) {
      setLoading(false);
      logger.error(e);
    }
  }, [kubernetesClusterName, selectedOperator, onOperatorUpdated]);

  const onClose = useCallback(() => {
    setVisible(false);
    setSelectedCluster(null);
    setOperatorToUpdate(null);
  }, [setVisible, setSelectedCluster, setOperatorToUpdate]);

  return (
    <div className={styles.modalWrapper}>
      <Modal title={title} isVisible={isVisible} onClose={onClose}>
        <h4 data-qa="update-operator-message" className={styles.updateModalContent}>
          {buildUpdateOperatorMessage(
            operatorTypeLabel,
            <span className={styles.versionHighlight}>{availableVersion}</span>,
            <span className={styles.versionHighlight}>{kubernetesClusterName}</span>,
            version
          )}
        </h4>
        <HorizontalGroup justify="space-between" spacing="md">
          <Button variant="secondary" size="md" onClick={onClose} data-qa="cancel-update-operator-button">
            {cancel}
          </Button>
          <Button size="md" onClick={updateOperator} data-qa="confirm-update-operator-button">
            {confirm}
          </Button>
        </HorizontalGroup>
      </Modal>
    </div>
  );
};
