import React from 'react';
import { SelectableValue } from '@grafana/data';
import { DBClusterComponent, DBClusterComponentVersionStatus, DBClusterMatrix } from '../../DBCluster/DBCluster.types';
import { DEFAULT_SUFFIX, VERSION_PREFIX } from './ManageComponentsVersionsModal.constants';
import { Messages } from './ManageComponentsVersionsModal.messages';
import {
  ManageComponentsVersionsRenderProps,
  ManageComponentVersionsFields,
  SupportedComponents,
} from './ManageComponentsVersionsModal.types';
import { OptionContent } from '../../DBCluster/OptionContent/OptionContent';

export const requiredVersions = (versions: SelectableValue[]) => {
  if (!versions || !Array.isArray(versions)) {
    return undefined;
  }

  const checked = versions.filter((v) => v.value);

  return checked.length > 0 ? undefined : Messages.required;
};

export const componentsToOptions = (value: DBClusterMatrix): SelectableValue[] =>
  Object.keys(value)
    .filter((key) => key in SupportedComponents)
    .map((key: SupportedComponents) => ({
      name: key,
      value: key,
      label: Messages.componentLabel[key],
    }));

export const versionsToOptions = (component: DBClusterComponent): SelectableValue[] =>
  Object.entries(component).map(([key, { status, disabled, default: isDefault }]) => ({
    name: `${VERSION_PREFIX}${key}`,
    value: !disabled,
    label: key,
    status,
    default: isDefault,
  }));

export const buildVersionsFieldName = (values: ManageComponentsVersionsRenderProps) => {
  if (!values[ManageComponentVersionsFields.operator] || !values[ManageComponentVersionsFields.component]) {
    return undefined;
  }

  return `${values[ManageComponentVersionsFields.operator].value}${
    values[ManageComponentVersionsFields.component].value
  }`;
};

export const buildDefaultFieldName = (values: ManageComponentsVersionsRenderProps) => {
  if (!values[ManageComponentVersionsFields.operator] || !values[ManageComponentVersionsFields.component]) {
    return undefined;
  }

  return `${values[ManageComponentVersionsFields.operator].value}${
    values[ManageComponentVersionsFields.component].value
  }${DEFAULT_SUFFIX}`;
};

export const findRecommendedVersions = (versions: SelectableValue[]) =>
  versions.filter(({ status }) => status === DBClusterComponentVersionStatus.recommended);

export const findDefaultVersion = (versions: SelectableValue[]): SelectableValue | undefined =>
  versions.find(({ default: isDefault }) => isDefault);

export const getDefaultOptions = (values: ManageComponentsVersionsRenderProps): SelectableValue[] => {
  const versionsFieldName = buildVersionsFieldName(values);
  const options = (versionsFieldName ? values[versionsFieldName] : []) as SelectableValue[];

  return options.filter(({ value }) => value);
};

export const defaultRequired = (option: SelectableValue) => (option && option.label ? undefined : Messages.required);

export const parseDefaultVersionsOptions = (options: SelectableValue[]) =>
  options.map(({ label, status, ...option }) => ({
    ...option,
    status,
    label: (
      <OptionContent
        title={label as string}
        tags={status === DBClusterComponentVersionStatus.recommended ? [Messages.recommended] : []}
        dataQa="kubernetes-default-version-option"
      />
    ),
  }));
