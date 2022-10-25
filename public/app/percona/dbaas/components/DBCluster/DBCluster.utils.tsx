/* eslint-disable  @typescript-eslint/consistent-type-assertions */
import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';

import { SERVICE_MAP, THOUSAND } from './DBCluster.constants';
import { DBClusterService } from './DBCluster.service';
import {
  DBCluster,
  DBClusterExpectedResources,
  DBClusterStatus,
  ResourcesUnits,
  ResourcesWithUnits,
} from './DBCluster.types';

export const isClusterChanging = ({ status }: DBCluster) => {
  return status === DBClusterStatus.changing || status === DBClusterStatus.deleting;
};

export const newDBClusterService = (type: Databases): DBClusterService => {
  const service = SERVICE_MAP[type] as DBClusterService;

  return service || SERVICE_MAP[Databases.mysql];
};

export const isOptionEmpty = (option?: SelectableValue) => !option || Object.keys(option).length === 0 || !option.value;

export const formatResources = (bytes: number, decimals: number): ResourcesWithUnits => {
  const i = Math.floor(Math.log(bytes) / Math.log(THOUSAND));
  const units = Object.values(ResourcesUnits)[i];

  return { value: parseFloat((bytes / Math.pow(THOUSAND, i)).toFixed(decimals)), units, original: bytes };
};

export const getResourcesDifference = (
  { value: valueA, original: originalA, units: unitsA }: ResourcesWithUnits,
  { value: valueB, original: originalB, units: unitsB }: ResourcesWithUnits
): ResourcesWithUnits | null => {
  if (unitsA !== unitsB) {
    return null;
  }

  return {
    original: originalA - originalB,
    value: valueA - valueB,
    units: unitsA,
  };
};

export const getResourcesSum = (
  { value: valueA, original: originalA, units: unitsA }: ResourcesWithUnits,
  { value: valueB, original: originalB, units: unitsB }: ResourcesWithUnits
): ResourcesWithUnits | null => {
  if (unitsA !== unitsB) {
    return null;
  }

  return {
    original: originalA + originalB,
    value: valueA + valueB,
    units: unitsA,
  };
};

export const getExpectedResourcesDifference = (
  { expected: { cpu: cpuA, memory: memoryA, disk: diskA } }: DBClusterExpectedResources,
  { expected: { cpu: cpuB, memory: memoryB, disk: diskB } }: DBClusterExpectedResources
): DBClusterExpectedResources => {
  return {
    expected: {
      cpu: getResourcesDifference(cpuA, cpuB) as ResourcesWithUnits,
      memory: getResourcesDifference(memoryA, memoryB) as ResourcesWithUnits,
      disk: getResourcesDifference(diskA, diskB) as ResourcesWithUnits,
    },
  };
};

export const formatDBClusterVersion = (version?: string) => (version ? version.split(':')[1].split('-')[0] : '');

export const formatDBClusterVersionWithBuild = (version?: string) => (version ? version.split(':')[1] : '');
