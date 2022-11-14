/* eslint-disable react/display-name */
import { Modal } from '@percona/platform-core';
import React, { FC, useMemo, useState } from 'react';
import { FormRenderProps } from 'react-final-form';
import { useSelector } from 'react-redux';

import { useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { StepProgress } from 'app/percona/dbaas/components/StepProgress/StepProgress';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';
import { getAddDbCluster } from 'app/percona/shared/core/selectors';

import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';

import { getStyles } from './AddDBClusterModal.styles';
import { AddDBClusterModalProps, AddDBClusterFields } from './AddDBClusterModal.types';
import { getInitialValues, updateDatabaseClusterNameInitialValue } from './AddDBClusterModal.utils';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { DBClusterBasicOptions } from './DBClusterBasicOptions/DBClusterBasicOptions';
import { UnsafeConfigurationWarning } from './UnsafeConfigurationsWarning/UnsafeConfigurationWarning';

export const AddDBClusterModal: FC<AddDBClusterModalProps> = ({
  kubernetes,
  isVisible,
  setVisible,
  onSubmit,
  preSelectedKubernetesCluster,
}) => {
  const styles = useStyles(getStyles);
  const { loading } = useSelector(getAddDbCluster);
  const [showPMMAddressWarning] = useShowPMMAddressWarning();
  const [showUnsafeConfigurationWarning, setShowUnsafeConfigurationWarning] = useState(false);

  const initialValues = useMemo(
    () => getInitialValues(kubernetes, preSelectedKubernetesCluster),
    [kubernetes, preSelectedKubernetesCluster]
  );

  const updatedItialValues = useMemo(
    () => (isVisible ? updateDatabaseClusterNameInitialValue(initialValues) : initialValues),
    [initialValues, isVisible]
  );

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
        render: (renderProps) => (
          <DBClusterAdvancedOptions
            setShowUnsafeConfigurationWarning={setShowUnsafeConfigurationWarning}
            {...renderProps}
          />
        ),
        dataTestId: 'dbcluster-advanced-options-step',
      },
    ],
    [kubernetes]
  );

  return (
    <div className={styles.modalWrapper} key="add-db-cluster-modal">
      <Modal title={Messages.dbcluster.addModal.title} isVisible={isVisible} onClose={() => setVisible(false)}>
        <div className={styles.stepProgressWrapper}>
          {showPMMAddressWarning && <PMMServerUrlWarning />}
          {showUnsafeConfigurationWarning && <UnsafeConfigurationWarning />}
          <StepProgress
            steps={steps}
            initialValues={updatedItialValues}
            submitButtonMessage={Messages.dbcluster.addModal.confirm}
            onSubmit={(values) => onSubmit(values, showPMMAddressWarning)}
            loading={loading}
          />
        </div>
      </Modal>
    </div>
  );
};
