import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { FormRenderProps } from 'react-final-form';
import { useStyles } from '@grafana/ui';
import { NumberInputField, RadioButtonGroupField } from '@percona/platform-core';
import validators from 'app/percona/shared/helpers/validators';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Databases } from 'app/percona/shared/core';
import {
  TOPOLOGY_OPTIONS,
  RESOURCES_OPTIONS,
  DEFAULT_SIZES,
  MIN_NODES,
  MIN_RESOURCES,
  MIN_DISK_SIZE,
} from './DBClusterAdvancedOptions.constants';
import { getStyles } from './DBClusterAdvancedOptions.styles';
import { AddDBClusterFields } from '../AddDBClusterModal.types';
import { DBClusterTopology, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { resourceValidator } from './DBClusterAdvancedOptions.utils';

export const DBClusterAdvancedOptions: FC<FormRenderProps> = ({ values, form }) => {
  const styles = useStyles(getStyles);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(DEFAULT_SIZES.small.memory);
  const [customCPU, setCustomCPU] = useState(DEFAULT_SIZES.small.cpu);
  const [customDisk, setCustomDisk] = useState(DEFAULT_SIZES.small.disk);
  const { required, min } = validators;
  const { change } = form;
  const diskValidators = [required, min(MIN_DISK_SIZE)];
  const nodeValidators = [required, min(MIN_NODES)];
  const parameterValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { topology, resources, memory, cpu, databaseType, disk } = values;

  const parsePositiveInt = useCallback(value => (value > 0 && Number.isInteger(+value) ? value : undefined), []);

  const parseNonNegativeFloat = useCallback(
    value => (value > 0 ? (+value).toFixed(1).replace(/\.0+$/, '') : value),
    []
  );

  const topologies = useMemo(
    () =>
      databaseType?.value !== Databases.mysql
        ? [TOPOLOGY_OPTIONS[0], { ...TOPOLOGY_OPTIONS[1], disabled: true }]
        : TOPOLOGY_OPTIONS,
    [databaseType]
  );

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
      <RadioButtonGroupField
        name={AddDBClusterFields.resources}
        label={Messages.dbcluster.addModal.fields.resources}
        options={RESOURCES_OPTIONS}
      />
      <div className={styles.resourcesWrapper}>
        <NumberInputField
          name={AddDBClusterFields.memory}
          label={Messages.dbcluster.addModal.fields.memory}
          validators={parameterValidators}
          disabled={resources !== DBClusterResources.custom}
          parse={parseNonNegativeFloat}
        />
        <NumberInputField
          name={AddDBClusterFields.cpu}
          label={Messages.dbcluster.addModal.fields.cpu}
          validators={parameterValidators}
          disabled={resources !== DBClusterResources.custom}
          parse={parseNonNegativeFloat}
        />
        <NumberInputField
          name={AddDBClusterFields.disk}
          label={Messages.dbcluster.addModal.fields.disk}
          validators={diskValidators}
          disabled={resources !== DBClusterResources.custom}
          parse={parsePositiveInt}
        />
      </div>
    </>
  );
};
