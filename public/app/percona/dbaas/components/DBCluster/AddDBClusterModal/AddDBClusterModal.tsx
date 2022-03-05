/* eslint-disable react/display-name */
import React, { FC, useMemo } from 'react';
import { Modal, logger } from '@percona/platform-core';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { useStyles } from '@grafana/ui';
import { StepProgress } from 'app/percona/dbaas/components/StepProgress/StepProgress';
import { AddDBClusterModalProps, AddDBClusterFields } from './AddDBClusterModal.types';
import { DBClusterBasicOptions } from './DBClusterBasicOptions/DBClusterBasicOptions';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { INITIAL_VALUES } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { newDBClusterService } from '../DBCluster.utils';
import { getStyles } from './AddDBClusterModal.styles';
import { FormRenderProps } from 'react-final-form';
import { getActiveOperators, getDatabaseOptionFromOperator } from '../../Kubernetes/Kubernetes.utils';
import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';

export const AddDBClusterModal: FC<AddDBClusterModalProps> = ({
  kubernetes,
  isVisible,
  setVisible,
  onDBClusterAdded,
  showMonitoringWarning,
}) => {
  const styles = useStyles(getStyles);

  const initialValues = useMemo(() => {
    const activeOperators = getActiveOperators(kubernetes);

    return {
      ...INITIAL_VALUES,
      [AddDBClusterFields.databaseType]:
        activeOperators.length === 1
          ? getDatabaseOptionFromOperator(activeOperators[0])
          : { value: undefined, label: undefined },
    };
  }, [kubernetes]);
  const steps = useMemo(
    () => [
      {
        title: Messages.dbcluster.addModal.steps.basicOptions,
        fields: [AddDBClusterFields.name, AddDBClusterFields.kubernetesCluster, AddDBClusterFields.databaseType],
        render: ({ form }: FormRenderProps) => <DBClusterBasicOptions kubernetes={kubernetes} form={form} />,
        dataTestId: 'dbcluster-basic-options-step',
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
        dataTestId: 'dbcluster-advanced-options-step',
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
    expose,
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
        expose,
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
          {showMonitoringWarning && <PMMServerUrlWarning />}
          <StepProgress
            steps={steps}
            initialValues={initialValues}
            submitButtonMessage={Messages.dbcluster.addModal.confirm}
            onSubmit={onSubmit}
          />
        </div>
      </Modal>
    </div>
  );
};
