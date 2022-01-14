import { dataQa } from '@percona/platform-core';
import { mount } from 'enzyme';
import React from 'react';
import Credentials from './Credentials';

describe('Credentials:: ', () => {
  it('should render access and secret keys fields', () => {
    const root = mount(<Credentials discover={jest.fn()} selectInstance={jest.fn()} />);

    expect(root.find(dataQa('aws_access_key-text-input')).exists()).toBeTruthy();
    expect(root.find(dataQa('aws_secret_key-password-input')).exists()).toBeTruthy();
  });

  it('should call discover on submit', () => {
    const discover = jest.fn();
    const root = mount(<Credentials discover={discover} selectInstance={jest.fn()} />);

    root.find('form').simulate('submit');

    expect(discover).toHaveBeenCalled();
  });
});
