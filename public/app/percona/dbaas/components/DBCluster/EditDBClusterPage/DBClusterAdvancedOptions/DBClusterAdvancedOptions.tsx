import { cx } from '@emotion/css';
import { logger, NumberInputField, SelectField } from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormRenderProps } from 'react-final-form';

import { useStyles } from '@grafana/ui/src';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { Databases } from 'app/percona/shared/core';
import validators from 'app/percona/shared/helpers/validators';

import FieldSet from '../../../../../shared/components/Form/FieldSet/FieldSet';
import { CPU, Disk, Memory } from '../../../DBaaSIcons';
import { DBClusterService } from '../../DBCluster.service';
import { DBCluster, DBClusterAllocatedResources, DBClusterExpectedResources } from '../../DBCluster.types';
import { getExpectedResourcesDifference, newDBClusterService } from '../../DBCluster.utils';
import { ResourcesBar } from '../../ResourcesBar/ResourcesBar';
import { optionRequired } from '../DBClusterBasicOptions/DBClusterBasicOptions.utils';
import { DBClusterPageMode } from '../EditDBClusterPage.types';
import { UnsafeConfigurationWarning } from '../UnsafeConfigurationsWarning/UnsafeConfigurationWarning';

import Configurations from './Configurations/Configurations';
import {
  DEFAULT_SIZES,
  EXPECTED_DELAY,
  MIN_DISK_SIZE,
  MIN_NODES,
  MIN_RESOURCES,
  RECHECK_INTERVAL,
  RESOURCES_OPTIONS,
} from './DBClusterAdvancedOptions.constants';
import { Messages } from './DBClusterAdvancedOptions.messages';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { AdvancedOptionsFields, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { canGetExpectedResources, nodesValidator, resourceValidator } from './DBClusterAdvancedOptions.utils';
import Templates from './Templates/Templates';

export interface DBClusterAdvancedOptionsProps extends FormRenderProps {
  mode: DBClusterPageMode;
  showUnsafeConfigurationWarning: boolean;
  setShowUnsafeConfigurationWarning: React.Dispatch<React.SetStateAction<boolean>>;
  selectedCluster?: DBCluster | null;
}

export const DBClusterAdvancedOptions: FC<DBClusterAdvancedOptionsProps> = ({
  showUnsafeConfigurationWarning,
  setShowUnsafeConfigurationWarning,
  mode,
  selectedCluster,
  values,
  form,
}) => {
  let allocatedTimer: NodeJS.Timeout;
  let expectedTimer: NodeJS.Timeout;
  const styles = useStyles(getStyles);
  const initialExpected = useRef<DBClusterExpectedResources>();
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(
    selectedCluster ? selectedCluster.memory : DEFAULT_SIZES.small.memory
  );
  const [customCPU, setCustomCPU] = useState(selectedCluster ? selectedCluster.cpu : DEFAULT_SIZES.small.cpu);
  const [customDisk, setCustomDisk] = useState(DEFAULT_SIZES.small.disk);
  const [allocatedResources, setAllocatedResources] = useState<DBClusterAllocatedResources>();
  const [loadingAllocatedResources, setLoadingAllocatedResources] = useState(false);
  const [expectedResources, setExpectedResources] = useState<DBClusterExpectedResources>();
  const [loadingExpectedResources, setLoadingExpectedResources] = useState(false);

  const mounted = { current: true };
  const { required, min } = validators;
  const { change } = form;
  const diskValidators = [required, min(MIN_DISK_SIZE)];
  const nodeValidators = [required, min(MIN_NODES), nodesValidator];
  const parameterValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { name, kubernetesCluster, topology, resources, memory, cpu, databaseType, disk, nodes, single } = values;
  const resourcesInputProps = { step: '0.1' };
  const collapsableProps =
    mode === 'create'
      ? {
          collapsableProps: {
            isOpen: false,
            buttonDataTestId: 'dbCluster-advanced-settings',
          },
        }
      : {};

  const parsePositiveInt = useCallback((value) => (value > 0 && Number.isInteger(+value) ? value : undefined), []);

  const resourcesBarStyles = useMemo(
    () => ({
      [styles.resourcesBar]: !!allocatedResources,
      [styles.resourcesBarEmpty]: !allocatedResources,
    }),
    [allocatedResources, styles.resourcesBar, styles.resourcesBarEmpty]
  );

  const getAllocatedResources = async (triggerLoading = true) => {
    try {
      if (allocatedTimer) {
        clearTimeout(allocatedTimer);
      }

      if (triggerLoading) {
        setLoadingAllocatedResources(true);
      }
      const alloc = await DBClusterService.getAllocatedResources(
        selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster.value
      );
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
      !selectedCluster && setCustomDisk(disk);
    }

    if (resources?.value && resources.value !== DBClusterResources.custom) {
      change(AdvancedOptionsFields.cpu, DEFAULT_SIZES[resources.value].cpu);
      change(AdvancedOptionsFields.memory, DEFAULT_SIZES[resources.value].memory);
      !selectedCluster && change(AdvancedOptionsFields.disk, DEFAULT_SIZES[resources.value].disk);
    } else {
      change(AdvancedOptionsFields.cpu, customCPU);
      change(AdvancedOptionsFields.memory, customMemory);
      !selectedCluster && change(AdvancedOptionsFields.disk, customDisk);
    }

    setPrevResources(resources?.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  useEffect(() => {
    if (selectedCluster ? selectedCluster : kubernetesCluster) {
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
      const dbTypeValue = selectedCluster ? selectedCluster.databaseType : databaseType?.value;

      try {
        const dbClusterService = newDBClusterService(dbTypeValue);
        setLoadingExpectedResources(true);

        const expected = await dbClusterService.getExpectedResources({
          clusterName: selectedCluster ? selectedCluster.clusterName : name,
          kubernetesClusterName: selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster,
          databaseType: dbTypeValue,
          clusterSize: nodes,
          cpu,
          memory,
          disk,
        });
        if (!initialExpected.current) {
          initialExpected.current = expected;
        }
        setExpectedResources(
          selectedCluster ? getExpectedResourcesDifference(expected, initialExpected.current) : expected
        );
      } catch (e) {
        logger.error(e);
      } finally {
        setLoadingExpectedResources(false);
      }
    };

    if (canGetExpectedResources(selectedCluster ? selectedCluster : kubernetesCluster, values)) {
      if (expectedTimer) {
        clearTimeout(expectedTimer);
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
      expectedTimer = setTimeout(() => getExpectedResources(), EXPECTED_DELAY);
    }

    return () => clearTimeout(expectedTimer);
  }, [memory, cpu, disk, kubernetesCluster, topology, nodes, single, databaseType]);

  useEffect(() => {
    const dbTypeValue = selectedCluster ? selectedCluster.databaseType : databaseType?.value;
    if (dbTypeValue === Databases.mongodb) {
      setShowUnsafeConfigurationWarning(nodes === 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseType, nodes]);

  return (
    <FieldSet label={Messages.fieldSets.advancedSettings} {...collapsableProps}>
      <>{showUnsafeConfigurationWarning && <UnsafeConfigurationWarning />}</>
      <Templates
        k8sClusterName={selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster?.value}
        databaseType={databaseType?.value}
      />
      <div className={styles.line}>
        <NumberInputField
          name={AdvancedOptionsFields.nodes}
          label={Messages.labels.nodes}
          validators={nodeValidators}
          parse={parsePositiveInt}
        />
        <SelectField
          name={AdvancedOptionsFields.resources}
          options={RESOURCES_OPTIONS}
          label={Messages.labels.resources}
          validate={optionRequired}
          defaultValue={false}
        />
      </div>
      <div className={styles.resourcesWrapper}>
        <div className={styles.resourcesInputCol}>
          <NumberInputField
            name={AdvancedOptionsFields.cpu}
            label={Messages.labels.cpu}
            validators={parameterValidators}
            disabled={resources?.value !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={AdvancedOptionsFields.memory}
            label={Messages.labels.memory}
            validators={parameterValidators}
            disabled={resources?.value !== DBClusterResources.custom}
            inputProps={resourcesInputProps}
          />
          <NumberInputField
            name={AdvancedOptionsFields.disk}
            label={Messages.labels.disk}
            validators={diskValidators}
            disabled={selectedCluster ? true : resources?.value !== DBClusterResources.custom}
            parse={parsePositiveInt}
          />
        </div>
        <div className={styles.resourcesBarCol}>
          <Overlay isPending={loadingAllocatedResources || loadingExpectedResources}>
            <ResourcesBar
              resourceLabel={Messages.labels.cpu}
              icon={<CPU />}
              total={allocatedResources?.total.cpu}
              allocated={allocatedResources?.allocated.cpu}
              expected={expectedResources?.expected.cpu}
              className={cx(resourcesBarStyles)}
              dataTestId="dbcluster-resources-bar-cpu"
            />
            <ResourcesBar
              resourceLabel={Messages.labels.memory}
              icon={<Memory />}
              total={allocatedResources?.total.memory}
              allocated={allocatedResources?.allocated.memory}
              expected={expectedResources?.expected.memory}
              className={cx(resourcesBarStyles)}
              dataTestId="dbcluster-resources-bar-memory"
            />
            <ResourcesBar
              resourceLabel={Messages.labels.disk}
              resourceEmptyValueMessage="Information about free disk space on the Kubernetes cluster is unavailable"
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
      <Configurations
        databaseType={selectedCluster ? selectedCluster.databaseType : databaseType?.value}
        k8sClusterName={selectedCluster ? selectedCluster.kubernetesClusterName : kubernetesCluster?.value}
        mode={mode}
        form={form}
      />
    </FieldSet>
  );
};
