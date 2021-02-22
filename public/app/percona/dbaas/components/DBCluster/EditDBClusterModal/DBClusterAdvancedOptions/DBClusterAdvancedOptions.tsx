import React, { FC, useCallback, useState, useMemo, useEffect } from 'react';
import { FormRenderProps } from 'react-final-form';
import { HorizontalGroup, useStyles } from '@grafana/ui';
import { LoaderButton, NumberInputField, RadioButtonGroupField } from '@percona/platform-core';
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
import { DBClusterTopology, DBClusterResources } from './DBClusterAdvancedOptions.types';
import { resourceValidator } from '../../AddDBClusterModal/DBClusterAdvancedOptions/DBClusterAdvancedOptions.utils';

export const DBClusterAdvancedOptions: FC<FormRenderProps> = ({ values, form, valid, pristine, submitting }) => {
  const styles = useStyles(getStyles);
  const [prevResources, setPrevResources] = useState(DBClusterResources.small);
  const [customMemory, setCustomMemory] = useState(DEFAULT_SIZES.small.memory);
  const [customCPU, setCustomCPU] = useState(DEFAULT_SIZES.small.cpu);
  const { required, min } = validators;
  const { change } = form;
  const nodeValidators = [required, min(MIN_NODES)];
  const resourceValidators = [required, min(MIN_RESOURCES), resourceValidator];
  const { topology, resources, memory, cpu, databaseType } = values;
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
      <RadioButtonGroupField
        name={EditDBClusterFields.resources}
        label={Messages.dbcluster.addModal.fields.resources}
        options={RESOURCES_OPTIONS}
      />
      <div className={styles.resourcesWrapper}>
        <NumberInputField
          name={EditDBClusterFields.memory}
          label={Messages.dbcluster.addModal.fields.memory}
          validators={resourceValidators}
          disabled={resources !== DBClusterResources.custom}
          parse={parseNonNegativeFloat}
        />
        <NumberInputField
          name={EditDBClusterFields.cpu}
          label={Messages.dbcluster.addModal.fields.cpu}
          validators={resourceValidators}
          disabled={resources !== DBClusterResources.custom}
          parse={parseNonNegativeFloat}
        />
        <NumberInputField
          name={EditDBClusterFields.disk}
          label={Messages.dbcluster.addModal.fields.disk}
          disabled
          parse={parsePositiveInt}
        />
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
