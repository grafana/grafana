import React, { FC, useMemo } from 'react';
import { Modal, logger } from '@percona/platform-core';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Icon, useStyles } from '@grafana/ui';
import { StepProgress } from 'app/percona/dbaas/components/StepProgress/StepProgress';
import { AddDBClusterModalProps, AddDBClusterFields } from './AddDBClusterModal.types';
import { DBClusterBasicOptions } from './DBClusterBasicOptions/DBClusterBasicOptions';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { INITIAL_VALUES } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { buildWarningMessage, newDBClusterService } from '../DBCluster.utils';
import { getStyles } from './AddDBClusterModal.styles';
import { FormRenderProps } from 'react-final-form';

export const AddDBClusterModal: FC<AddDBClusterModalProps> = ({
  kubernetes,
  isVisible,
  setVisible,
  onDBClusterAdded,
  showMonitoringWarning,
}) => {
  const styles = useStyles(getStyles);

  const steps = useMemo(
    () => [
      {
        title: Messages.dbcluster.addModal.steps.basicOptions,
        fields: [AddDBClusterFields.name, AddDBClusterFields.kubernetesCluster, AddDBClusterFields.databaseType],
        render: ({ form }: FormRenderProps) => <DBClusterBasicOptions kubernetes={kubernetes} form={form} />,
        dataQa: 'dbcluster-basic-options-step',
      },
      {
        title: Messages.dbcluster.addModal.steps.advancedOptions,
        fields: [
          AddDBClusterFields.topology,
          AddDBClusterFields.nodes,
          AddDBClusterFields.memory,
          AddDBClusterFields.cpu,
          AddDBClusterFields.disk,
        ],
        render: (renderProps) => <DBClusterAdvancedOptions {...renderProps} />,
        dataQa: 'dbcluster-advanced-options-step',
      },
    ],
    [kubernetes]
  );
  const onSubmit = async ({
    name,
    kubernetesCluster,
    databaseType,
    databaseVersion,
    topology,
    nodes,
    single,
    memory,
    cpu,
    disk,
  }: Record<string, any>) => {
    try {
      const dbClusterService = newDBClusterService(databaseType.value);

      await dbClusterService.addDBCluster({
        kubernetesClusterName: kubernetesCluster.value,
        clusterName: name,
        databaseType: databaseType.value,
        clusterSize: topology === DBClusterTopology.cluster ? nodes : single,
        cpu,
        memory,
        disk,
        databaseImage: databaseVersion.value,
      });
      setVisible(false);
      onDBClusterAdded();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <div className={styles.modalWrapper}>
      <Modal title={Messages.dbcluster.addModal.title} isVisible={isVisible} onClose={() => setVisible(false)}>
        <div className={styles.stepProgressWrapper}>
          {showMonitoringWarning && (
            <div className={styles.warningWrapper} data-qa="add-cluster-monitoring-warning">
              <Icon name="exclamation-triangle" className={styles.warningIcon} />
              <span className={styles.warningMessage}>{buildWarningMessage(styles.settingsLink)}</span>
            </div>
          )}
          <StepProgress
            steps={steps}
            initialValues={INITIAL_VALUES}
            submitButtonMessage={Messages.dbcluster.addModal.confirm}
            onSubmit={onSubmit}
          />
        </div>
      </Modal>
    </div>
  );
};
