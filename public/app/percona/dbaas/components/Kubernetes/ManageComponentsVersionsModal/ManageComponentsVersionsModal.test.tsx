import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import {
  operatorsOptionsStubs,
  psmdbComponentOptionsStubs,
  versionsFieldNameStub,
  versionsStubs,
} from './__mocks__/componentsVersionsStubs';

jest.mock('app/core/app_events');
jest.mock('./ManageComponentsVersions.hooks');

xdescribe('ManageComponentsVersionsModal::', () => {
  it('renders form with operator, component and versions field with correct values', () => {
    const root = mount(
      <ManageComponentsVersionsModal isVisible selectedKubernetes={kubernetesStub[0]} setVisible={jest.fn()} />
    );
    const operator = root.find(dataTestId('kubernetes-operator'));
    const component = root.find(dataTestId('kubernetes-component'));
    const versions = root.find(dataTestId(`${versionsFieldNameStub}-options`));

    expect(operator.text().includes(operatorsOptionsStubs[0].label)).toBeTruthy();
    expect(component.text().includes(psmdbComponentOptionsStubs[0].label)).toBeTruthy();
    expect(versions.children().length).toBe(versionsStubs.length);
    expect(root.find(dataTestId('kubernetes-default-version')).exists()).toBeTruthy();
  });
  it('calls setVisible on cancel', () => {
    const setVisible = jest.fn();
    const root = mount(
      <ManageComponentsVersionsModal isVisible selectedKubernetes={kubernetesStub[0]} setVisible={setVisible} />
    );

    root.find(dataTestId('kubernetes-components-versions-cancel')).find('button').simulate('click');

    expect(setVisible).toHaveBeenCalledWith(false);
  });
});
