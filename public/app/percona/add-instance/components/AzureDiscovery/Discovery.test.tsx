import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import React from 'react';
import Discovery from './Discovery';

xdescribe('Discovery instance:: ', () => {
  it('Should render correct', () => {
    const selectInstance = jest.fn();

    const root = mount(<Discovery selectInstance={selectInstance} />);

    expect(root.find(dataTestId('azure_client_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataTestId('azure_client_secret-password-input')).exists()).toBeTruthy();
    expect(root.find(dataTestId('azure_tenant_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataTestId('azure_subscription_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataTestId('credentials-search-button')).exists()).toBeTruthy();
  });
});
