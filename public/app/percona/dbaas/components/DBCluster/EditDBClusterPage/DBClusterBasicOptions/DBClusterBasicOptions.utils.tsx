import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data/src';

import { Kubernetes } from '../../../Kubernetes/Kubernetes.types';
import { KubernetesOperatorStatus } from '../../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { DatabaseVersion } from '../../DBCluster.types';
import { OptionContent } from '../../OptionContent/OptionContent';
import { Messages } from '../EditDBClusterPage.messages';

import { DatabaseOperators, OPERATORS } from './DBClusterBasicOptions.constants';
import { KubernetesOption as KubernetesOptionInterface, KubernetesOptionProps } from './DBClusterBasicOptions.types';

export const kubernetesClusterNameValidator = (value: string) => {
  const clusterNameRegexp = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;

  return clusterNameRegexp.test(value) ? undefined : Messages.validationMessages.clusterName;
};

const KubernetesOption: FC<React.PropsWithChildren<KubernetesOptionProps>> = ({
  disabledOperators,
  availableOperators,
  kubernetesClusterName,
}) => (
  <OptionContent
    title={kubernetesClusterName}
    description={disabledOperators.length ? Messages.validationMessages.notInstalledOperator : ''}
    tags={availableOperators.map((databaseType) => DatabaseOperators[databaseType])}
    disabledTags={disabledOperators.map((databaseType) => DatabaseOperators[databaseType])}
    dataTestId="kubernetes-option"
  />
);

export const getKubernetesOptions = (kubernetes: Kubernetes[]): KubernetesOptionInterface[] =>
  kubernetes
    .map((kubernetesCluster) => {
      const { kubernetesClusterName, operators } = kubernetesCluster;

      const availableOperators = OPERATORS.filter(
        (databaseType) => operators[databaseType].status === KubernetesOperatorStatus.ok
      );
      const disabledOperators = OPERATORS.filter(
        (databaseType) => operators[databaseType].status !== KubernetesOperatorStatus.ok
      );

      return {
        value: kubernetesClusterName,
        label: (
          <KubernetesOption
            kubernetesClusterName={kubernetesClusterName}
            availableOperators={availableOperators}
            disabledOperators={disabledOperators}
          />
        ),
        operators,
        availableOperators,
      };
    })
    .filter((operators) => operators.availableOperators.length);

export const optionRequired = (option: SelectableValue) =>
  option && option.label && option.value ? undefined : Messages.validationMessages.requiredField;

export const findDefaultDatabaseVersion = (versions: DatabaseVersion[]) => versions.find((version) => version.default);
