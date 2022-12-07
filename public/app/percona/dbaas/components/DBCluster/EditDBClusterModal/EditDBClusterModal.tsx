import { Modal, logger } from '@percona/platform-core';
import React, { FC, useRef, useState } from 'react';
import { Form as FormFinal } from 'react-final-form';

import { useStyles } from '@grafana/ui';
import { DATABASE_LABELS } from 'app/percona/shared/core';

import { newDBClusterService } from '../DBCluster.utils';
import { MIN_NODES } from '../EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { UnsafeConfigurationWarning } from '../EditDBClusterPage/UnsafeConfigurationsWarning/UnsafeConfigurationWarning';

import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { DEFAULT_SIZES } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { getStyles } from './EditDBClusterModal.styles';
import { EditDBClusterModalProps, EditDBClusterRenderProps } from './EditDBClusterModal.types';

export const EditDBClusterModal: FC<EditDBClusterModalProps> = ({
  isVisible,
  setVisible,
  onDBClusterChanged,
  selectedCluster,
}) => {
  const styles = useStyles(getStyles);
  const initialValues = useRef<EditDBClusterRenderProps>();
  const [showUnsafeConfigurationWarning, setShowUnsafeConfigurationWarning] = useState(false);
  const onSubmit = async ({ topology, nodes, single, memory, cpu, disk }: Record<string, any>) => {
    if (!selectedCluster) {
      setVisible(false);

      return;
    }

    try {
      const dbClusterService = newDBClusterService(selectedCluster.databaseType);

      await dbClusterService.updateDBCluster({
        databaseImage: selectedCluster.installedImage,
        databaseType: selectedCluster.databaseType,
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

  const editModalTitle = `${selectedCluster?.clusterName} ( ${selectedCluster?.databaseType} )`;

  if (!initialValues.current) {
    const isCluster = selectedCluster.clusterSize > 1;
    const clusterParameters: EditDBClusterRenderProps = {
      topology: isCluster ? DBClusterTopology.cluster : DBClusterTopology.single,
      nodes: isCluster ? selectedCluster.clusterSize : MIN_NODES,
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

    initialValues.current = clusterParameters;
  }

  return (
    <div className={styles.modalWrapper}>
      <Modal title={editModalTitle} isVisible={isVisible} onClose={() => setVisible(false)}>
        {showUnsafeConfigurationWarning && <UnsafeConfigurationWarning />}
        <FormFinal
          onSubmit={onSubmit}
          initialValues={initialValues.current}
          render={(renderProps) => (
            <form onSubmit={renderProps.handleSubmit}>
              <DBClusterAdvancedOptions
                selectedCluster={selectedCluster}
                renderProps={renderProps}
                setShowUnsafeConfigurationWarning={setShowUnsafeConfigurationWarning}
              />
            </form>
          )}
        />
      </Modal>
    </div>
  );
};
