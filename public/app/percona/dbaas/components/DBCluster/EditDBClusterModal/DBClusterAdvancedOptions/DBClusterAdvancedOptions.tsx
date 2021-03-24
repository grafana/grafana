import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { cx } from 'emotion';
import { HorizontalGroup, Icon, useStyles } from '@grafana/ui';
import { LoaderButton, NumberInputField, RadioButtonGroupField, logger } from '@percona/platform-core';
import validators from 'app/percona/shared/helpers/validators';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Databases } from 'app/percona/shared/core';
import {
  TOPOLOGY_OPTIONS,
  RESOURCES_OPTIONS,
  DEFAULT_SIZES,
  MIN_NODES,
  MIN_RESOURCES,
} from './DBClusterAdvancedOptions.constants';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { EditDBClusterFields } from '../EditDBClusterModal.types';
import { DBClusterTopology, DBClusterResources, DBClusterAdvancedOptionsProps } from './DBClusterAdvancedOptions.types';
import { resourceValidator } from '../../AddDBClusterModal/DBClusterAdvancedOptions/DBClusterAdvancedOptions.utils';
import { DBClusterAllocatedResources, DBClusterExpectedResources } from '../../DBCluster.types';
import { DBClusterService } from '../../DBCluster.service';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { CPU, Memory } from '../../../DBaaSIcons';
import {
  CPU_UNITS,
  MEMORY_UNITS,
  RECHECK_INTERVAL,
  EXPECTED_DELAY,
} from '../../AddDBClusterModal/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { newDBClusterService } from '../../DBCluster.utils';

export const DBClusterAdvancedOptions: FC<DBClusterAdvancedOptionsProps> = ({ selectedCluster, renderProps }) => {
  let allocatedTimer: NodeJS.Timeout;
  let expectedTimer: NodeJS.Timeout;
  const { values, form, valid, pristine, submitting } = renderProps;
  const styles = useStyles(getStyles);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(DEFAULT_SIZES.small.memory);
  const [customCPU, setCustomCPU] = useState(DEFAULT_SIZES.small.cpu);
  const [allocatedResources, setAllocatedResources] = useState<DBClusterAllocatedResources>();
  const [loadingAllocatedResources, setLoadingAllocatedResources] = useState(false);
  const [expectedResources, setExpectedResources] = useState<DBClusterExpectedResources>();
  const [loadingExpectedResources, setLoadingExpectedResources] = useState(false);
  const { required, min } = validators;
  const { change } = form;
  const nodeValidators = [required, min(MIN_NODES)];
  const resourceValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { topology, resources, memory, cpu, disk, nodes, single } = values;
  const parsePositiveInt = useCallback(value => (value > 0 && Number.isInteger(+value) ? value : undefined), []);
  const resourcesBarStyles = useMemo(
    () => ({
      [styles.resourcesBar]: !!allocatedResources,
      [styles.resourcesBarEmpty]: !allocatedResources,
    }),
    [allocatedResources]
  );
  const resourcesInputProps = { step: '0.1' };

  const topologies = useMemo(
    () =>
      selectedCluster.databaseType !== Databases.mysql
        ? [TOPOLOGY_OPTIONS[0], { ...TOPOLOGY_OPTIONS[1], disabled: true }]
        : TOPOLOGY_OPTIONS,
    [selectedCluster]
  );

  const getAllocatedResources = async (triggerLoading = true) => {
    try {
      if (triggerLoading) {
        setLoadingAllocatedResources(true);
      }
      setAllocatedResources(await DBClusterService.getAllocatedResources(selectedCluster.kubernetesClusterName));
    } catch (e) {
      logger.error(e);
    } finally {
      if (triggerLoading) {
        setLoadingAllocatedResources(false);
      }
    }
  };

  const getExpectedResources = async () => {
    try {
      const dbClusterService = newDBClusterService(selectedCluster.databaseType);

      setLoadingExpectedResources(true);
      setExpectedResources(
        await dbClusterService.getExpectedResources({
          clusterName: selectedCluster.clusterName,
          kubernetesClusterName: selectedCluster.kubernetesClusterName,
          databaseType: selectedCluster.databaseType,
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

  useEffect(() => {
    if (prevResources === DBClusterResources.custom) {
      setCustomMemory(memory);
      setCustomCPU(cpu);
    }

    if (resources && resources !== DBClusterResources.custom) {
      change(EditDBClusterFields.cpu, DEFAULT_SIZES[resources].cpu);
      change(EditDBClusterFields.memory, DEFAULT_SIZES[resources].memory);
    } else {
      change(EditDBClusterFields.cpu, customCPU);
      change(EditDBClusterFields.memory, customMemory);
    }

    setPrevResources(resources);
  }, [resources]);

  useEffect(() => {
    if (selectedCluster) {
      getAllocatedResources();

      allocatedTimer = setInterval(() => getAllocatedResources(false), RECHECK_INTERVAL);
    }

    return () => clearTimeout(allocatedTimer);
  }, [selectedCluster]);

  useEffect(() => {
    if (selectedCluster && memory > 0 && cpu > 0 && disk > 0) {
      if (expectedTimer) {
        clearTimeout(expectedTimer);
      }

      expectedTimer = setTimeout(() => getExpectedResources(), EXPECTED_DELAY);
    }

    return () => clearTimeout(expectedTimer);
  }, [memory, cpu, selectedCluster, topology, nodes, single]);

  return (
    <>
      <RadioButtonGroupField
        name={EditDBClusterFields.topology}
        label={Messages.dbcluster.addModal.fields.topology}
        options={topologies}
      />
      <div className={styles.nodesWrapper}>
        {topology === DBClusterTopology.single ? (
          <NumberInputField
            name={EditDBClusterFields.single}
            label={Messages.dbcluster.addModal.fields.nodes}
            disabled
          />
        ) : (
          <NumberInputField
            name={EditDBClusterFields.nodes}
            label={Messages.dbcluster.addModal.fields.nodes}
            validators={nodeValidators}
            parse={parsePositiveInt}
          />
        )}
      </div>
      <div className={styles.resourcesRadioWrapper}>
        <RadioButtonGroupField
          name={EditDBClusterFields.resources}
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
            name={EditDBClusterFields.memory}
            label={Messages.dbcluster.addModal.fields.memory}
            validators={resourceValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={EditDBClusterFields.cpu}
            label={Messages.dbcluster.addModal.fields.cpu}
            validators={resourceValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={EditDBClusterFields.disk}
            label={Messages.dbcluster.addModal.fields.disk}
            disabled
            parse={parsePositiveInt}
          />
        </div>
        <div className={styles.resourcesBarCol}>
          <Overlay isPending={loadingAllocatedResources || loadingExpectedResources}>
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.memory}
              icon={<Memory />}
              total={allocatedResources?.total.memory}
              allocated={allocatedResources?.allocated.memory}
              expected={expectedResources?.expected.memory}
              className={cx(resourcesBarStyles)}
              units={MEMORY_UNITS}
              dataQa="dbcluster-resources-bar-memory"
            />
            <ResourcesBar
              resourceLabel={Messages.dbcluster.addModal.resourcesBar.cpu}
              icon={<CPU />}
              total={allocatedResources?.total.cpu}
              allocated={allocatedResources?.allocated.cpu}
              expected={expectedResources?.expected.cpu}
              className={cx(resourcesBarStyles)}
              units={CPU_UNITS}
              dataQa="dbcluster-resources-bar-cpu"
            />
          </Overlay>
        </div>
      </div>
      <HorizontalGroup justify="center" spacing="md">
        <LoaderButton
          data-qa="dbcluster-update-cluster-button"
          size="md"
          variant="primary"
          disabled={!valid || pristine || submitting}
          loading={submitting}
          className={styles.createButton}
        >
          {Messages.dbcluster.editModal.confirm}
        </LoaderButton>
      </HorizontalGroup>
    </>
  );
};
