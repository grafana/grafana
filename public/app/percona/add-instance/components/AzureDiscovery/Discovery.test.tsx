import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import React from 'react';
import Discovery from './Discovery';

describe('Discovery instance:: ', () => {
  it('Should render correct', () => {
    const selectInstance = jest.fn();

    const root = mount(<Discovery selectInstance={selectInstance} />);

    expect(root.find(dataQa('azure_client_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('azure_client_secret-password-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('azure_tenant_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('azure_subscription_id-text-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('credentials-search-button')).exists()).toBeTruthy();
  });
});
