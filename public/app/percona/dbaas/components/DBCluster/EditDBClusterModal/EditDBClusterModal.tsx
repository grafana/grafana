import React, { FC, useEffect, useState } from 'react';
import { Modal, logger } from '@percona/platform-core';
import { Form as FormFinal } from 'react-final-form';
import { EditDBClusterModalProps, EditDBClusterRenderProps } from './EditDBClusterModal.types';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { DEFAULT_SIZES } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { newDBClusterService } from '../DBCluster.utils';

export const EditDBClusterModal: FC<EditDBClusterModalProps> = ({
  isVisible,
  setVisible,
  onDBClusterChanged,
  selectedCluster,
}) => {
  const onSubmit = async ({ databaseType, topology, nodes, single, memory, cpu, disk }: Record<string, any>) => {
    if (!selectedCluster) {
      setVisible(false);

      return;
    }

    try {
      const dbClusterService = newDBClusterService(databaseType);

      await dbClusterService.updateDBCluster({
        databaseType,
        clusterName: selectedCluster.clusterName,
        kubernetesClusterName: selectedCluster.kubernetesClusterName,
        clusterSize: topology === DBClusterTopology.cluster ? nodes : single,
        cpu,
        memory,
        disk,
      });
      setVisible(false);
      onDBClusterChanged();
    } catch (e) {
      logger.error(e);
    }
  };

  const [initialValues, setInitialValues] = useState({});
  const editModalTitle = `${selectedCluster?.clusterName} ( ${selectedCluster?.databaseType} )`;

  useEffect(() => {
    if (!selectedCluster) {
      setVisible(false);

      return;
    }

    const clusterParameters: EditDBClusterRenderProps = {
      topology: selectedCluster.clusterSize > 1 ? DBClusterTopology.cluster : DBClusterTopology.single,
      nodes: selectedCluster.clusterSize,
      single: 1,
      databaseType: {
        value: selectedCluster.databaseType,
        label: DATABASE_LABELS[selectedCluster.databaseType],
      },
      cpu: selectedCluster.cpu,
      disk: selectedCluster.disk,
      memory: selectedCluster.memory,
    };

    const isMatchSize = (type: DBClusterResources) =>
      DEFAULT_SIZES[type].cpu === selectedCluster.cpu &&
      DEFAULT_SIZES[type].memory === selectedCluster.memory &&
      DEFAULT_SIZES[type].disk === selectedCluster.disk;

    if (isMatchSize(DBClusterResources.small)) {
      clusterParameters.resources = DBClusterResources.small;
    } else if (isMatchSize(DBClusterResources.medium)) {
      clusterParameters.resources = DBClusterResources.medium;
    } else if (isMatchSize(DBClusterResources.large)) {
      clusterParameters.resources = DBClusterResources.large;
    } else {
      clusterParameters.resources = DBClusterResources.custom;
    }

    setInitialValues(clusterParameters);
  }, [selectedCluster]);

  return (
    <Modal title={editModalTitle} isVisible={isVisible} onClose={() => setVisible(false)}>
      <FormFinal
        onSubmit={onSubmit}
        initialValues={initialValues}
        render={renderProps => (
          <form onSubmit={renderProps.handleSubmit}>
            <DBClusterAdvancedOptions {...renderProps} />
          </form>
        )}
      />
    </Modal>
  );
};
