import { SelectableValue } from '@grafana/data';

import {
  DEFAULT_SUFFIX,
  VERSION_PREFIX,
} from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.constants';
import {
  ManageComponentsVersionsRenderProps,
  SupportedComponents,
} from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.types';

import { DBClusterChangeComponentAPI } from './DBCluster.types';
import { Operators } from './EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';

export const getComponentChange = (
  operator: Operators,
  component: SupportedComponents,
  componentsVersions: ManageComponentsVersionsRenderProps
): DBClusterChangeComponentAPI => {
  const name = `${operator}${component}`;
  const defaultName = `${name}${DEFAULT_SUFFIX}`;
  const versions = componentsVersions[name] as SelectableValue[];
  const defaultVersion = componentsVersions[defaultName];

  return {
    default_version: defaultVersion.name.replace(VERSION_PREFIX, ''),
    versions: versions.map(({ label, value }) => ({
      version: label as string,
      ...(value && { enable: true }),
      ...(!value && { disable: true }),
    })),
  };
};
