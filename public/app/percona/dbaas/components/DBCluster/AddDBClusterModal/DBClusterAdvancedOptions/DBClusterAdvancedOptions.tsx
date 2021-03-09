import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { FormRenderProps } from 'react-final-form';
import { cx } from 'emotion';
import { Icon, useStyles } from '@grafana/ui';
import { NumberInputField, RadioButtonGroupField, logger } from '@percona/platform-core';
import validators from 'app/percona/shared/helpers/validators';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Databases } from 'app/percona/shared/core';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import {
  TOPOLOGY_OPTIONS,
  RESOURCES_OPTIONS,
  DEFAULT_SIZES,
  MIN_NODES,
  MIN_RESOURCES,
  MIN_DISK_SIZE,
  MEMORY_UNITS,
  CPU_UNITS,
  RECHECK_INTERVAL,
} from './DBClusterAdvancedOptions.constants';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { AddDBClusterFields } from '../AddDBClusterModal.types';
import { DBClusterTopology, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { resourceValidator } from './DBClusterAdvancedOptions.utils';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { CPU, Memory } from '../../../DBaaSIcons';
import { DBClusterService } from '../../DBCluster.service';
import { DBClusterAllocatedResources } from '../../DBCluster.types';

export const DBClusterAdvancedOptions: FC<FormRenderProps> = ({ values, form }) => {
  let timer: NodeJS.Timeout;
  const styles = useStyles(getStyles);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(DEFAULT_SIZES.small.memory);
  const [customCPU, setCustomCPU] = useState(DEFAULT_SIZES.small.cpu);
  const [customDisk, setCustomDisk] = useState(DEFAULT_SIZES.small.disk);
  const [allocatedResources, setAllocatedResources] = useState<DBClusterAllocatedResources>();
  const [loadingResources, setLoadingResources] = useState(false);
  const { required, min } = validators;
  const { change } = form;
  const diskValidators = [required, min(MIN_DISK_SIZE)];
  const nodeValidators = [required, min(MIN_NODES)];
  const parameterValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { kubernetesCluster, topology, resources, memory, cpu, databaseType, disk } = values;
  const resourcesBarStyles = useMemo(
    () => ({
      [styles.resourcesBar]: !!allocatedResources,
      [styles.resourcesBarEmpty]: !allocatedResources,
    }),
    [allocatedResources]
  );
  const resourcesInputProps = { step: '0.1' };

  const parsePositiveInt = useCallback(value => (value > 0 && Number.isInteger(+value) ? value : undefined), []);

  const topologies = useMemo(
    () =>
      databaseType?.value !== Databases.mysql
        ? [TOPOLOGY_OPTIONS[0], { ...TOPOLOGY_OPTIONS[1], disabled: true }]
        : TOPOLOGY_OPTIONS,
    [databaseType]
  );

  const getResources = async (triggerLoading = true) => {
    try {
      if (triggerLoading) {
        setLoadingResources(true);
      }
      setAllocatedResources(await DBClusterService.getAllocatedResources(kubernetesCluster.value));
    } catch (e) {
      logger.error(e);
    } finally {
      if (triggerLoading) {
        setLoadingResources(false);
      }
    }
  };

  useEffect(() => {
    if (prevResources === DBClusterResources.custom) {
      setCustomMemory(memory);
      setCustomCPU(cpu);
      setCustomDisk(disk);
    }

    if (resources && resources !== DBClusterResources.custom) {
      change(AddDBClusterFields.cpu, DEFAULT_SIZES[resources].cpu);
      change(AddDBClusterFields.memory, DEFAULT_SIZES[resources].memory);
      change(AddDBClusterFields.disk, DEFAULT_SIZES[resources].disk);
    } else {
      change(AddDBClusterFields.cpu, customCPU);
      change(AddDBClusterFields.memory, customMemory);
      change(AddDBClusterFields.disk, customDisk);
    }

    setPrevResources(resources);
  }, [resources]);

  useEffect(() => {
    if (kubernetesCluster) {
      getResources();

      timer = setInterval(() => getResources(false), RECHECK_INTERVAL);
    }

    return () => clearInterval(timer);
  }, [kubernetesCluster]);

  return (
    <>
      <RadioButtonGroupField
        name={AddDBClusterFields.topology}
        label={Messages.dbcluster.addModal.fields.topology}
        options={topologies}
      />
      <div className={styles.nodesWrapper}>
        {topology === DBClusterTopology.single ? (
          <NumberInputField
            name={AddDBClusterFields.single}
            label={Messages.dbcluster.addModal.fields.nodes}
            disabled
          />
        ) : (
          <NumberInputField
            name={AddDBClusterFields.nodes}
            label={Messages.dbcluster.addModal.fields.nodes}
            validators={nodeValidators}
            parse={parsePositiveInt}
          />
        )}
      </div>
      <div className={styles.resourcesRadioWrapper}>
        <RadioButtonGroupField
          name={AddDBClusterFields.resources}
          label={Messages.dbcluster.addModal.fields.resources}
          options={RESOURCES_OPTIONS}
        />
        <div className={styles.resourcesInfoWrapper}>
          <Icon className={styles.resourcesInfoIcon} name="info-circle" />
          <span>{Messages.dbcluster.addModal.resourcesInfo}</span>
        </div>
      </div>
      <div className={styles.resourcesWrapper}>
        <div className={styles.resourcesInputCol}>
          <NumberInputField
            name={AddDBClusterFields.memory}
            label={Messages.dbcluster.addModal.fields.memory}
            validators={parameterValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={AddDBClusterFields.cpu}
            label={Messages.dbcluster.addModal.fields.cpu}
            validators={parameterValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={AddDBClusterFields.disk}
            label={Messages.dbcluster.addModal.fields.disk}
            validators={diskValidators}
            disabled={resources !== DBClusterResources.custom}
            parse={parsePositiveInt}
          />
        </div>
        <div className={styles.resourcesBarCol}>
          <Overlay isPending={loadingResources}>
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.memory}
              icon={<Memory />}
              total={allocatedResources?.total.memory}
              allocated={allocatedResources?.allocated.memory}
              expected={undefined}
              className={cx(resourcesBarStyles)}
              units={MEMORY_UNITS}
              dataQa="dbcluster-resources-bar-memory"
            />
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.cpu}
              icon={<CPU />}
              total={allocatedResources?.total.cpu}
              allocated={allocatedResources?.allocated.cpu}
              expected={undefined}
              className={cx(resourcesBarStyles)}
              units={CPU_UNITS}
              dataQa="dbcluster-resources-bar-cpu"
            />
            {/* <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.disk}
              icon={<Disk />}
              total={allocatedResources?.total.disk}
              allocated={allocatedResources?.allocated.disk}
              expected={undefined}
              className={styles.resourcesBarLast}
              dataQa="dbcluster-resources-bar-disk"
            /> */}
          </Overlay>
        </div>
      </div>
    </>
  );
};
