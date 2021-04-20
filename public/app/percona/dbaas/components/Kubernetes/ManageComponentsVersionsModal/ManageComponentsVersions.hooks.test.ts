import * as _ from 'lodash';
import { renderHook } from '@testing-library/react-hooks';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { useOperatorsComponentsVersions } from './ManageComponentsVersions.hooks';
import {
  psmdbComponentOptionsStubs,
  initialValuesStubs,
  operatorsOptionsStubs,
  possibleComponentOptionsStubs,
  versionsStubs,
  versionsFieldNameStub,
  omitDefaultLabels,
} from './__mocks__/componentsVersionsStubs';

jest.mock('../../DBCluster/XtraDB.service');
jest.mock('../../DBCluster/PSMDB.service');

describe('ManageComponentsVersions.hooks::', () => {
  it('returns operator components options, versions and initial values with two operators', async () => {
    const wrapper = renderHook(() => useOperatorsComponentsVersions(kubernetesStub[0]));

    await wrapper.waitForNextUpdate();

    const [
      initialValues,
      operatorsOptions,
      componentOptions,
      possibleComponentOptions,
      versionsOptions,
      versionsFieldName,
    ] = wrapper.result.current;

    expect(_.omit(initialValues, omitDefaultLabels)).toEqual(_.omit(initialValuesStubs, omitDefaultLabels));
    expect(possibleComponentOptions).toEqual(possibleComponentOptionsStubs);
    expect(operatorsOptions).toEqual(operatorsOptionsStubs);
    expect(componentOptions).toEqual(psmdbComponentOptionsStubs);
    expect(versionsOptions).toEqual(versionsStubs);
    expect(versionsFieldName).toEqual(versionsFieldNameStub);
  });
  it('returns operator components options, versions and initial values with one operator', async () => {
    const wrapper = renderHook(() => useOperatorsComponentsVersions(_.omit(kubernetesStub[0], 'operators.xtradb')));

    await wrapper.waitForNextUpdate();

    const [
      initialValues,
      operatorsOptions,
      componentOptions,
      possibleComponentOptions,
      versionsOptions,
      versionsFieldName,
    ] = wrapper.result.current;

    expect(_.omit(initialValues, omitDefaultLabels)).toEqual(
      _.omit(
        initialValuesStubs,
        ['xtradbpxc', 'xtradbhaproxy', 'xtradbpxcdefault', 'xtradbhaproxydefault'].concat(omitDefaultLabels)
      )
    );
    expect(possibleComponentOptions).toEqual(_.omit(possibleComponentOptionsStubs, 'xtradb'));
    expect(operatorsOptions).toEqual([operatorsOptionsStubs[0]]);
    expect(componentOptions).toEqual(psmdbComponentOptionsStubs);
    expect(versionsOptions).toEqual(versionsStubs);
    expect(versionsFieldName).toEqual(versionsFieldNameStub);
  });
});
