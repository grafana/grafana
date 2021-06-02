import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import Discovery from './Discovery';

describe('Discovery instance:: ', () => {
  it('Should render correct', () => {
    const selectInstance = jest.fn();

    const root = mount(<Discovery selectInstance={selectInstance} />);

    expect(root.find(dataQa('aws_access_key-text-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('aws_secret_key-password-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('credentials-search-button')).exists()).toBeTruthy();
  });
});
