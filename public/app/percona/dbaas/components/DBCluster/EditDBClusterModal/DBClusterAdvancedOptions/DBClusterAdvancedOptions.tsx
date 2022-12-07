import { cx } from '@emotion/css';
import { logger, NumberInputField, RadioButtonGroupField, LoaderButton } from '@percona/platform-core';
import React, { FC, useCallback, useState, useMemo, useEffect, useRef } from 'react';

import { HorizontalGroup, Icon, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { Databases } from 'app/percona/shared/core';
import validators from 'app/percona/shared/helpers/validators';

import { CPU, Disk, Memory } from '../../../DBaaSIcons';
import { DBClusterService } from '../../DBCluster.service';
import { DBClusterAllocatedResources, DBClusterExpectedResources } from '../../DBCluster.types';
import { getExpectedResourcesDifference, newDBClusterService } from '../../DBCluster.utils';
import {
  RECHECK_INTERVAL,
  EXPECTED_DELAY,
} from '../../EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import {
  canGetExpectedResources,
  resourceValidator,
} from '../../EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.utils';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { EditDBClusterFields } from '../EditDBClusterModal.types';

import {
  TOPOLOGY_OPTIONS,
  RESOURCES_OPTIONS,
  DEFAULT_SIZES,
  MIN_NODES,
  MIN_RESOURCES,
} from './DBClusterAdvancedOptions.constants';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { DBClusterTopology, DBClusterResources, DBClusterAdvancedOptionsProps } from './DBClusterAdvancedOptions.types';

export const DBClusterAdvancedOptions: FC<DBClusterAdvancedOptionsProps> = ({
  selectedCluster,
  renderProps,
  setShowUnsafeConfigurationWarning,
}) => {
  const { values, form, valid, pristine, submitting } = renderProps;
  const styles = useStyles(getStyles);
  const initialExpected = useRef<DBClusterExpectedResources>();
  const unmounted = useRef<boolean>(false);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(selectedCluster.memory);
  const [customCPU, setCustomCPU] = useState(selectedCluster.cpu);
  const [allocatedResources, setAllocatedResources] = useState<DBClusterAllocatedResources>();
  const [loadingAllocatedResources, setLoadingAllocatedResources] = useState(false);
  const [expectedResources, setExpectedResources] = useState<DBClusterExpectedResources>();
  const [loadingExpectedResources, setLoadingExpectedResources] = useState(false);
  const { required, min } = validators;
  const { change } = form;
  const nodeValidators = [required, min(MIN_NODES)];
  const resourceValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { topology, resources, memory, cpu, disk, nodes, single } = values;
  const parsePositiveInt = useCallback((value) => (value > 0 && Number.isInteger(+value) ? value : undefined), []);
  const resourcesBarStyles = useMemo(
    () => ({
      [styles.resourcesBar]: !!allocatedResources,
      [styles.resourcesBarEmpty]: !allocatedResources,
    }),
    [allocatedResources, styles.resourcesBar, styles.resourcesBarEmpty]
  );
  const resourcesInputProps = { step: '0.1' };
  let allocatedTimer: NodeJS.Timeout;
  let expectedTimer: NodeJS.Timeout;

  const topologies = useMemo(
    () =>
      selectedCluster.databaseType !== Databases.mysql && selectedCluster?.databaseType !== Databases.mongodb
        ? [TOPOLOGY_OPTIONS[0], { ...TOPOLOGY_OPTIONS[1], disabled: true }]
        : TOPOLOGY_OPTIONS,
    [selectedCluster]
  );

  const getAllocatedResources = async (triggerLoading = true) => {
    try {
      if (allocatedTimer) {
        clearTimeout(allocatedTimer);
      }

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

      if (!unmounted.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        allocatedTimer = setTimeout(() => getAllocatedResources(false), RECHECK_INTERVAL);
      }
    }
  };

  const getExpectedResources = async () => {
    try {
      const dbClusterService = newDBClusterService(selectedCluster.databaseType);

      setLoadingExpectedResources(true);

      const expected = await dbClusterService.getExpectedResources({
        clusterName: selectedCluster.clusterName,
        kubernetesClusterName: selectedCluster.kubernetesClusterName,
        databaseType: selectedCluster.databaseType,
        clusterSize: topology === DBClusterTopology.cluster ? nodes : single,
        cpu,
        memory,
        disk,
      });

      // store current cluster expected (consumed) resources
      // to use in future expected resources calculations
      if (!initialExpected.current) {
        initialExpected.current = expected;
      }

      setExpectedResources(getExpectedResourcesDifference(expected, initialExpected.current));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  useEffect(() => {
    getAllocatedResources();

    return () => {
      clearTimeout(allocatedTimer);
      unmounted.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (canGetExpectedResources(selectedCluster, values)) {
      if (expectedTimer) {
        clearTimeout(expectedTimer);
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
      expectedTimer = setTimeout(() => getExpectedResources(), EXPECTED_DELAY);
    }

    return () => clearTimeout(expectedTimer);
  }, [memory, cpu, selectedCluster, topology, nodes, single]);

  useEffect(() => {
    if (selectedCluster.databaseType === Databases.mongodb) {
      if (topology === DBClusterTopology.cluster) {
        setShowUnsafeConfigurationWarning(false);
      } else {
        setShowUnsafeConfigurationWarning(true);
      }
    }

    if (topology === DBClusterTopology.cluster && nodes < MIN_NODES) {
      change(EditDBClusterFields.nodes, MIN_NODES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology]);

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
            name={EditDBClusterFields.cpu}
            label={Messages.dbcluster.addModal.fields.cpu}
            validators={resourceValidators}
            disabled={resources !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={EditDBClusterFields.memory}
            label={Messages.dbcluster.addModal.fields.memory}
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
              icon={<Disk />}
              total={allocatedResources?.total.disk}
              allocated={allocatedResources?.allocated.disk}
              expected={undefined}
              className={cx(resourcesBarStyles, styles.resourcesBarLast)}
              dataTestId="dbcluster-resources-bar-disk"
            />
          </Overlay>
        </div>
      </div>
      <HorizontalGroup justify="center" spacing="md">
        <LoaderButton
          data-testid="dbcluster-update-cluster-button"
          size="md"
          variant="primary"
          disabled={!valid || pristine || submitting}
          loading={submitting}
          className={styles.createButton}
          type="submit"
        >
          {Messages.dbcluster.editModal.confirm}
        </LoaderButton>
      </HorizontalGroup>
    </>
  );
};
