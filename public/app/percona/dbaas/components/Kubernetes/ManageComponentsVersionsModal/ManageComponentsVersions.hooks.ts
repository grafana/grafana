import { logger } from '@percona/platform-core';
import { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';

import { DATABASE_OPERATORS } from '../../DBCluster/DBCluster.constants';
import { DBClusterVersion } from '../../DBCluster/DBCluster.types';
import { newDBClusterService } from '../../DBCluster/DBCluster.utils';
import { Operators } from '../../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { Kubernetes } from '../Kubernetes.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

import {
  buildDefaultFieldName,
  buildVersionsFieldName,
  componentsToOptions,
  findDefaultVersion,
  parseDefaultVersionsOptions,
  versionsToOptions,
} from './ManageComponentsVersions.utils';
import { DEFAULT_SUFFIX } from './ManageComponentsVersionsModal.constants';
import { Messages } from './ManageComponentsVersionsModal.messages';
import {
  ManageComponentsVersionsRenderProps,
  ManageComponentVersionsFields,
  SupportedComponents,
  PossibleComponentOptions,
  SetComponentOptionsAction,
  SetVersionsOptionsAction,
  SetVersionsFieldNameAction,
  SetDefaultFieldNameAction,
} from './ManageComponentsVersionsModal.types';

export const useOperatorsComponentsVersions = (
  kubernetes: Kubernetes
): [
  ManageComponentsVersionsRenderProps,
  SelectableValue[],
  SelectableValue[],
  PossibleComponentOptions,
  SelectableValue[],
  string,
  string,
  boolean,
  SetComponentOptionsAction,
  SetVersionsOptionsAction,
  SetVersionsFieldNameAction,
  SetDefaultFieldNameAction
] => {
  const [initialValues, setInitialValues] = useState({} as ManageComponentsVersionsRenderProps);
  const [operatorsOptions, setOperatorsOptions] = useState<SelectableValue[]>([]);
  const [componentOptions, setComponentOptions] = useState<SelectableValue[]>([]);
  const [possibleComponentOptions, setPossibleComponentOptions] = useState({} as PossibleComponentOptions);
  const [versionsOptions, setVersionsOptions] = useState<SelectableValue[]>([]);
  const [versionsFieldName, setVersionsFieldName] = useState('');
  const [defaultFieldName, setDefaultFieldName] = useState(DEFAULT_SUFFIX);
  const [loadingComponents, setLoadingComponents] = useState(false);

  useEffect(() => {
    const getComponents = async () => {
      try {
        const { operators, kubernetesClusterName } = kubernetes;
        const operatorsList = Object.entries(operators);
        let availableOperatorOptions = [] as SelectableValue[];
        let possibleComponentOptions = {} as PossibleComponentOptions;
        let initialValues = {} as ManageComponentsVersionsRenderProps;

        setLoadingComponents(true);

        for (const [operator, { status }] of operatorsList) {
          if (status === KubernetesOperatorStatus.ok) {
            [availableOperatorOptions, possibleComponentOptions, initialValues] = await getOperatorComponentsOptions(
              operator as Operators,
              kubernetesClusterName,
              availableOperatorOptions,
              possibleComponentOptions,
              initialValues
            );
          }
        }

        const name = buildVersionsFieldName(initialValues) as string;
        const defaultName = buildDefaultFieldName(initialValues) as string;
        const selectedOperator = initialValues.operator.value as Operators;

        setComponentOptions(possibleComponentOptions[selectedOperator] as SelectableValue[]);
        setOperatorsOptions(availableOperatorOptions);
        setPossibleComponentOptions(possibleComponentOptions);
        setVersionsOptions(initialValues[name]);
        setVersionsFieldName(name);
        setDefaultFieldName(defaultName);
        setInitialValues(initialValues);
      } catch (e) {
        logger.error(e);
      } finally {
        setLoadingComponents(false);
      }
    };
    getComponents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [
    initialValues,
    operatorsOptions,
    componentOptions,
    possibleComponentOptions,
    versionsOptions,
    versionsFieldName,
    defaultFieldName,
    loadingComponents,
    setComponentOptions,
    setVersionsOptions,
    setVersionsFieldName,
    setDefaultFieldName,
  ];
};

const getOperatorComponentsOptions = async (
  operator: Operators,
  kubernetesClusterName: string,
  operatorOptions: SelectableValue[],
  componentOptions: PossibleComponentOptions,
  initialValues: ManageComponentsVersionsRenderProps
): Promise<[SelectableValue[], PossibleComponentOptions, ManageComponentsVersionsRenderProps]> => {
  const service = newDBClusterService(DATABASE_OPERATORS[operator] as Databases);
  const components = await service.getComponents(kubernetesClusterName);
  const operatorVersion = components.versions[0];
  const options = componentsToOptions(operatorVersion.matrix);
  const newComponentOptions = {
    ...componentOptions,
    [operator]: options,
  };
  const newOperatorOptions = [
    ...operatorOptions,
    {
      name: operator,
      value: operator,
      label: Messages.operatorLabel[operator](operatorVersion.operator),
    },
  ];
  const newInitialValues = buildInitialValues(initialValues, operator, operatorVersion, newOperatorOptions, options);

  return [newOperatorOptions, newComponentOptions, newInitialValues];
};

const buildInitialValues = (
  initialValues: ManageComponentsVersionsRenderProps,
  operator: Operators,
  operatorVersion: DBClusterVersion,
  operatorOptions: SelectableValue[],
  componentOptions: SelectableValue[]
): ManageComponentsVersionsRenderProps => {
  const newInitialValues = {} as ManageComponentsVersionsRenderProps;

  if (Object.keys(initialValues).length === 0) {
    newInitialValues[ManageComponentVersionsFields.operator] = operatorOptions[0];
    newInitialValues[ManageComponentVersionsFields.component] = componentOptions[0];
  }

  Object.keys(SupportedComponents).forEach((key) => {
    const versions = operatorVersion.matrix[key as SupportedComponents];

    if (versions) {
      const versionsOptions = versionsToOptions(versions);

      newInitialValues[`${operator}${key}`] = versionsOptions;
      newInitialValues[`${operator}${key}${DEFAULT_SUFFIX}`] = parseDefaultVersionsOptions([
        findDefaultVersion(versionsOptions) as SelectableValue,
      ])[0];
    }
  });

  return { ...initialValues, ...newInitialValues };
};
