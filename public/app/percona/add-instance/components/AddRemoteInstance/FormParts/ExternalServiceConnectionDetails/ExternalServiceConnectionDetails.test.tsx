import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Form } from 'react-final-form';
import { ExternalServiceConnectionDetails } from './ExternalServiceConnectionDetails';

describe('Add remote instance:: ', () => {
  it('should render correct for mysql and postgres and highlight empty mandatory fields on submit', async () => {
    render(
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

    const metricsParametrsRadioState = screen.getByTestId('metricsParameters-radio-state');
    fireEvent.change(metricsParametrsRadioState, { target: { value: 'parsed' } });

    const urlTextInput = screen.getByTestId('url-text-input');
    fireEvent.change(urlTextInput, { target: { value: 'https://admin:admin@localhost/metrics' } });

    fireEvent.change(metricsParametrsRadioState, { target: { value: 'manually' } });

    expect((screen.getByTestId('address-text-input') as HTMLInputElement).value).toEqual('localhost');
    expect((screen.getByTestId('metrics_path-text-input') as HTMLInputElement).value).toEqual('/metrics');
    expect((screen.getByTestId('port-text-input') as HTMLInputElement).value).toEqual('443');
    expect((screen.getByTestId('username-text-input') as HTMLInputElement).value).toEqual('admin');
    expect((screen.getByTestId('password-password-input') as HTMLInputElement).value).toEqual('admin');
  });
});
