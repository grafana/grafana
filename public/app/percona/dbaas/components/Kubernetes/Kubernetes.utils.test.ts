import { Operators } from '../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { DATABASE_OPTIONS } from '../DBCluster/DBCluster.constants';

import { getActiveOperators, getDatabaseOptionFromOperator, isKubernetesListUnavailable } from './Kubernetes.utils';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { kubernetesStub } from './__mocks__/kubernetesStubs';

describe('Kubernetes.utils:: ', () => {
  it('should return false when there are clusters available', () => {
    expect(isKubernetesListUnavailable(kubernetesStub)).toBeFalsy();
  });
  it('should return true when there are no clusters available', () => {
    const kubernetes = [
      { ...kubernetesStub[0], status: KubernetesClusterStatus.invalid },
      { ...kubernetesStub[1], status: KubernetesClusterStatus.unavailable },
    ];
    expect(isKubernetesListUnavailable(kubernetes)).toBeTruthy();
  });
  it('should return empty list of active operators', () => {
    const kubernetes = [
      {
        ...kubernetesStub[0],
        operators: {
          psmdb: { status: KubernetesOperatorStatus.invalid },
          pxc: { status: KubernetesOperatorStatus.unavailable },
        },
      },
      {
        ...kubernetesStub[1],
        operators: {
          psmdb: { status: KubernetesOperatorStatus.unsupported },
          pxc: { status: KubernetesOperatorStatus.unavailable },
        },
      },
    ];
    expect(getActiveOperators(kubernetes).length).toBe(0);
  });
  it('should return list of with all active operators', () => {
    const kubernetes = [
      {
        ...kubernetesStub[0],
        operators: { psmdb: { status: KubernetesOperatorStatus.ok }, pxc: { status: KubernetesOperatorStatus.ok } },
      },
      {
        ...kubernetesStub[1],
        operators: {
          psmdb: { status: KubernetesOperatorStatus.ok },
          pxc: { status: KubernetesOperatorStatus.unavailable },
        },
      },
    ];
    expect(getActiveOperators(kubernetes).length).toBe(2);
  });
  it('should return list with one active operator', () => {
    const kubernetes = [
      {
        ...kubernetesStub[0],
        operators: {
          psmdb: { status: KubernetesOperatorStatus.ok },
          pxc: { status: KubernetesOperatorStatus.unavailable },
        },
      },
      {
        ...kubernetesStub[1],
        operators: {
          psmdb: { status: KubernetesOperatorStatus.unsupported },
          pxc: { status: KubernetesOperatorStatus.unavailable },
        },
      },
    ];
    const activeOperators = getActiveOperators(kubernetes);

    expect(activeOperators.length).toBe(1);
    expect(activeOperators[0]).toEqual(Operators.psmdb);
  });
  it('returns correct database option from operator', () => {
    expect(getDatabaseOptionFromOperator(Operators.pxc)).toEqual(DATABASE_OPTIONS[0]);
    expect(getDatabaseOptionFromOperator(Operators.psmdb)).toEqual(DATABASE_OPTIONS[1]);
  });
});
