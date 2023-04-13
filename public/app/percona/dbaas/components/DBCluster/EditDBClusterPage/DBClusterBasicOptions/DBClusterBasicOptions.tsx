import { TextInputField, validators } from '@percona/platform-core';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { Field } from 'react-final-form';

import { SelectableValue } from '@grafana/data/src';
import { useStyles } from '@grafana/ui/src';
import {
  AsyncSelectFieldAdapter,
  SelectFieldAdapter,
} from 'app/percona/shared/components/Form/FieldAdapters/FieldAdapters';

import { Kubernetes, Operator } from '../../../Kubernetes/Kubernetes.types';
import { getDatabaseOptionFromOperator } from '../../../Kubernetes/Kubernetes.utils';
import { KubernetesOperatorStatus } from '../../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { DATABASE_OPTIONS } from '../../DBCluster.constants';
import { isOptionEmpty } from '../../DBCluster.utils';

import { CLUSTER_NAME_MAX_LENGTH } from './DBClusterBasicOptions.constants';
import { useDatabaseVersions } from './DBClusterBasicOptions.hooks';
import { Messages } from './DBClusterBasicOptions.messages';
import { getStyles } from './DBClusterBasicOptions.styles';
import {
  BasicOptionsFields,
  DatabaseOption,
  DBClusterBasicOptionsProps,
  Operators,
} from './DBClusterBasicOptions.types';
import { getKubernetesOptions, kubernetesClusterNameValidator, optionRequired } from './DBClusterBasicOptions.utils';

const getAvailableDatabaseOptions = (kubernetesCluster: Kubernetes): DatabaseOption[] => {
  const { operators } = kubernetesCluster;
  const availableDatabaseOptions: DatabaseOption[] = [];

  Object.entries(operators).forEach(([operator, { status }]: [string, Operator]) => {
    if (status === KubernetesOperatorStatus.ok) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      availableDatabaseOptions.push(getDatabaseOptionFromOperator(operator as Operators) as DatabaseOption);
    }
  });

  return availableDatabaseOptions;
};

export const DBClusterBasicOptions: FC<DBClusterBasicOptionsProps> = ({ kubernetes, form }) => {
  const styles = useStyles(getStyles);
  const { required, maxLength } = validators;
  const { change } = form;
  const { kubernetesCluster, databaseType } = form.getState().values;
  const [databaseVersions, setDatabaseVersions] = useState<SelectableValue[]>([]);
  const [loadingDatabaseVersions, setLoadingDatabaseVersions] = useState(false);

  const onChangeDatabase = useCallback((databaseType) => {
    change(BasicOptionsFields.databaseType, databaseType);
    form.mutators.setClusterName(databaseType.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kubernetesOptions = getKubernetesOptions(kubernetes);

  const [databaseOptions, setDatabaseOptions] = useState(() => {
    if (kubernetesCluster) {
      return getAvailableDatabaseOptions(kubernetesCluster);
    }
    return DATABASE_OPTIONS;
  });

  const onChangeCluster = useCallback((selectedKubernetes) => {
    const availableDatabaseOptions = getAvailableDatabaseOptions(selectedKubernetes);

    if (availableDatabaseOptions.length === 1) {
      change(BasicOptionsFields.databaseType, availableDatabaseOptions[0]);
    } else {
      change(BasicOptionsFields.databaseType, {
        value: undefined,
        label: undefined,
      });
    }

    setDatabaseOptions(availableDatabaseOptions);
    change(BasicOptionsFields.kubernetesCluster, selectedKubernetes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDatabaseVersionDisabled = useMemo(() => isOptionEmpty(databaseType), [databaseType]);
  useDatabaseVersions(form, databaseType, kubernetesCluster, setLoadingDatabaseVersions, setDatabaseVersions);

  return (
    <div data-testid="dbcluster-basic-options-step" className={styles.basicOptions}>
      <Field
        dataTestId="dbcluster-kubernetes-cluster-field"
        name={BasicOptionsFields.kubernetesCluster}
        label={Messages.labels.kubernetesCluster}
        options={kubernetesOptions}
        component={SelectFieldAdapter}
        noOptionsMessage={Messages.noOperatorsMessage}
        validate={required}
        onChange={onChangeCluster}
      />
      <div className={styles.line}>
        <Field
          disabled={!form.getState().values[BasicOptionsFields.kubernetesCluster] || !databaseOptions.length}
          dataTestId="dbcluster-database-type-field"
          name={BasicOptionsFields.databaseType}
          label={Messages.labels.databaseType}
          options={databaseOptions}
          component={SelectFieldAdapter}
          validate={optionRequired}
          onChange={onChangeDatabase}
        />
        <Field
          disabled={isDatabaseVersionDisabled}
          dataTestId="dbcluster-database-version-field"
          name={BasicOptionsFields.databaseVersion}
          label={Messages.labels.databaseVersion}
          component={AsyncSelectFieldAdapter}
          loading={loadingDatabaseVersions}
          options={databaseVersions}
          validate={optionRequired}
        />
      </div>
      <TextInputField
        name={BasicOptionsFields.name}
        label={Messages.labels.clusterName}
        validators={[required, kubernetesClusterNameValidator, maxLength(CLUSTER_NAME_MAX_LENGTH)]}
      />
    </div>
  );
};
