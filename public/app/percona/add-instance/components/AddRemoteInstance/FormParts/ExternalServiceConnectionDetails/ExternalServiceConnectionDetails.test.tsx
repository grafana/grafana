import { mount } from 'enzyme';
import React from 'react';
import { dataTestId } from '@percona/platform-core';
import { Form } from 'react-final-form';
import { ExternalServiceConnectionDetails } from './ExternalServiceConnectionDetails';

xdescribe('Add remote instance:: ', () => {
  it('should render correct for mysql and highlight empty mandatory fields on submit', async () => {
    const root = mount(
      <Form
        onSubmit={jest.fn()}
        mutators={{
          setValue: ([field, value], state, { changeValue }) => {
            changeValue(state, field, () => value);
          },
        }}
        render={({ form }) => <ExternalServiceConnectionDetails form={form} />}
      />
    );

    root.find(dataTestId('metricsParameters-radio-state')).simulate('change', { target: { value: 'parsed' } });

    root.update();

    root
      .find(dataTestId('url-text-input'))
      .simulate('change', { target: { value: 'https://admin:admin@localhost/metrics' } });

    root.update();

    root.find(dataTestId('metricsParameters-radio-state')).simulate('change', { target: { value: 'manually' } });

    root.update();

    expect(root.find(dataTestId('address-text-input')).props().value).toEqual('localhost');
    expect(root.find(dataTestId('metrics_path-text-input')).props().value).toEqual('/metrics');
    expect(root.find(dataTestId('port-text-input')).props().value).toEqual('443');
    expect(root.find(dataTestId('username-text-input')).props().value).toEqual('admin');
    expect(root.find(dataTestId('password-password-input')).props().value).toEqual('admin');
  });
});
