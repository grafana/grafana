import { cx } from '@emotion/css';
import { NumberInputField, RadioButtonGroupField, logger } from '@percona/platform-core';
import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { FormRenderProps } from 'react-final-form';

import { Icon, useStyles } from '@grafana/ui/src';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { Databases } from 'app/percona/shared/core';
import validators from 'app/percona/shared/helpers/validators';

import { CPU, Disk, Memory } from '../../../DBaaSIcons';
import { SwitchField } from '../../../Switch/Switch';
import { DBClusterService } from '../../DBCluster.service';
import { DBClusterAllocatedResources, DBClusterExpectedResources } from '../../DBCluster.types';
import { newDBClusterService } from '../../DBCluster.utils';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { AddDBClusterFields } from '../EditDBClusterPage.types';

import {
  TOPOLOGY_OPTIONS,
  RESOURCES_OPTIONS,
  DEFAULT_SIZES,
  MIN_NODES,
  MIN_RESOURCES,
  MIN_DISK_SIZE,
  RECHECK_INTERVAL,
  EXPECTED_DELAY,
} from './DBClusterAdvancedOptions.constants';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { DBClusterTopology, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { canGetExpectedResources, resourceValidator } from './DBClusterAdvancedOptions.utils';

export interface DBClusterAdvancedOptionsProps extends FormRenderProps {
  setShowUnsafeConfigurationWarning: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DBClusterAdvancedOptions: FC<DBClusterAdvancedOptionsProps> = ({
  setShowUnsafeConfigurationWarning,
  values,
  form,
}) => {
  let allocatedTimer: NodeJS.Timeout;
  let expectedTimer: NodeJS.Timeout;
  const styles = useStyles(getStyles);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(DEFAULT_SIZES.small.memory);
  const [customCPU, setCustomCPU] = useState(DEFAULT_SIZES.small.cpu);
  const [customDisk, setCustomDisk] = useState(DEFAULT_SIZES.small.disk);
  const [allocatedResources, setAllocatedResources] = useState<DBClusterAllocatedResources>();
  const [loadingAllocatedResources, setLoadingAllocatedResources] = useState(false);
  const [expectedResources, setExpectedResources] = useState<DBClusterExpectedResources>();
  const [loadingExpectedResources, setLoadingExpectedResources] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mounted = { current: true };
  const { required, min } = validators;
  const { change } = form;
  const diskValidators = [required, min(MIN_DISK_SIZE)];
  const nodeValidators = [required, min(MIN_NODES)];
  const parameterValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { name, kubernetesCluster, topology, resources, memory, cpu, databaseType, disk, nodes, single } = values;
  const resourcesInputProps = { step: '0.1' };

  const parsePositiveInt = useCallback((value) => (value > 0 && Number.isInteger(+value) ? value : undefined), []);

  const resourcesBarStyles = useMemo(
    () => ({
      [styles.resourcesBar]: !!allocatedResources,
      [styles.resourcesBarEmpty]: !allocatedResources,
    }),
    [allocatedResources, styles.resourcesBar, styles.resourcesBarEmpty]
  );

  const topologies = useMemo(
    () =>
      databaseType?.value !== Databases.mysql && databaseType?.value !== Databases.mongodb
        ? [TOPOLOGY_OPTIONS[0], { ...TOPOLOGY_OPTIONS[1], disabled: true }]
        : TOPOLOGY_OPTIONS,
    [databaseType]
  );

  const getAllocatedResources = async (triggerLoading = true) => {
    try {
      if (allocatedTimer) {
        clearTimeout(allocatedTimer);
      }

      if (triggerLoading) {
        setLoadingAllocatedResources(true);
      }
      const alloc = await DBClusterService.getAllocatedResources(kubernetesCluster.value);
      setAllocatedResources(alloc);
    } catch (e) {
      logger.error(e);
    } finally {
      if (triggerLoading) {
        setLoadingAllocatedResources(false);
      }

      // don't schedule another request if the component was unmounted while the previous request was occuring
      if (mounted.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        allocatedTimer = setTimeout(() => getAllocatedResources(false), RECHECK_INTERVAL);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  useEffect(() => {
    if (kubernetesCluster) {
      getAllocatedResources();
    }

    return () => {
      mounted.current = false;
      clearTimeout(allocatedTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kubernetesCluster]);

  useEffect(() => {
    const getExpectedResources = async () => {
      try {
        const dbClusterService = newDBClusterService(databaseType.value);
        setLoadingExpectedResources(true);
        setExpectedResources(
          await dbClusterService.getExpectedResources({
            clusterName: name,
            kubernetesClusterName: kubernetesCluster,
            databaseType: databaseType.value,
            clusterSize: topology === DBClusterTopology.cluster ? nodes : single,
            cpu,
            memory,
            disk,
          })
        );
      } catch (e) {
        logger.error(e);
      } finally {
        setLoadingExpectedResources(false);
      }
    };

    if (canGetExpectedResources(kubernetesCluster, values)) {
      if (expectedTimer) {
        clearTimeout(expectedTimer);
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
      expectedTimer = setTimeout(() => getExpectedResources(), EXPECTED_DELAY);
    }

    return () => clearTimeout(expectedTimer);
  }, [memory, cpu, disk, kubernetesCluster, topology, nodes, single, databaseType]);

  useEffect(() => {
    if (databaseType?.value === Databases.mongodb) {
      if (topology === DBClusterTopology.cluster) {
        setShowUnsafeConfigurationWarning(false);
      } else {
        setShowUnsafeConfigurationWarning(true);
      }
    }
    if (topology === DBClusterTopology.cluster && nodes < MIN_NODES) {
      change(AddDBClusterFields.nodes, MIN_NODES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology]);

  return (
    <div data-testid="dbcluster-advanced-options-step">
      <div className={styles.line}>
        <RadioButtonGroupField
          name={AddDBClusterFields.topology}
          label={Messages.dbcluster.addModal.fields.topology}
          options={topologies}
          className={styles.resourcesRadioBtnGroup}
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
        <SwitchField
          name={AddDBClusterFields.expose}
          label={Messages.dbcluster.addModal.fields.expose}
          tooltip={Messages.dbcluster.addModal.exposeTooltip}
        />
      </div>
      <div className={styles.resourcesRadioWrapper}>
        <RadioButtonGroupField
          name={AddDBClusterFields.resources}
          label={Messages.dbcluster.addModal.fields.resources}
          options={RESOURCES_OPTIONS}
          className={styles.resourcesRadioBtnGroup}
        />
        <div className={styles.resourcesInfoWrapper}>
          <Icon className={styles.resourcesInfoIcon} name="info-circle" />
          <span>{Messages.dbcluster.addModal.resourcesInfo}</span>
        </div>
      </div>
      <div className={styles.resourcesWrapper}>
        <div className={styles.resourcesInputCol}>
          <NumberInputField
            name={AddDBClusterFields.cpu}
            label={Messages.dbcluster.addModal.fields.cpu}
            validators={parameterValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={AddDBClusterFields.memory}
            label={Messages.dbcluster.addModal.fields.memory}
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
          <Overlay isPending={loadingAllocatedResources || loadingExpectedResources}>
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.cpu}
              icon={<CPU />}
              total={allocatedResources?.total.cpu}
              allocated={allocatedResources?.allocated.cpu}
              expected={expectedResources?.expected.cpu}
              className={cx(resourcesBarStyles)}
              dataTestId="dbcluster-resources-bar-cpu"
            />
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.memory}
              icon={<Memory />}
              total={allocatedResources?.total.memory}
              allocated={allocatedResources?.allocated.memory}
              expected={expectedResources?.expected.memory}
              className={cx(resourcesBarStyles)}
              dataTestId="dbcluster-resources-bar-memory"
            />
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.disk}
              resourceEmptyValueMessage={'Information about free disk space on the Kubernetes cluster is unavailable'}
              icon={<Disk />}
              total={allocatedResources?.total.disk}
              allocated={allocatedResources?.allocated.disk}
              expected={expectedResources?.expected.disk}
              className={styles.resourcesBarLast}
              dataTestId="dbcluster-resources-bar-disk"
            />
          </Overlay>
        </div>
      </div>
    </div>
  );
};
