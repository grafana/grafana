import { render, screen, waitFor } from '@testing-library/react';
import { FormApi, FormState } from 'final-form';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { Databases } from 'app/percona/shared/core';
import { configureStore } from 'app/store/configureStore';

import { AdditionalOptionsFormPart, getAdditionalOptions } from './AdditionalOptions/AdditionalOptions';
import { ExternalServiceConnectionDetails } from './ExternalServiceConnectionDetails/ExternalServiceConnectionDetails';
import { trackingOptions, rdsTrackingOptions } from './FormParts.constants';
import { LabelsFormPart } from './Labels/Labels';
import { MainDetailsFormPart } from './MainDetails/MainDetails';

jest.mock('app/percona/inventory/Inventory.service');

const form: Partial<FormApi> = {
  change: jest.fn(),
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  getState: () => ({}) as FormState<any>,
};

describe('MainDetailsFormPart ::', () => {
  it('should disable fields with sat isRDS flag', async () => {
    const { container } = render(
      <Provider store={configureStore()}>
        <Form
          onSubmit={jest.fn()}
          render={({ form }) => <MainDetailsFormPart form={form} remoteInstanceCredentials={{ isRDS: true }} />}
        />
      </Provider>
    );

    const fields = container.querySelectorAll('input');
    await waitFor(() => expect(fields.length).toBe(8));

    expect(screen.getByTestId('address-text-input')).toBeDisabled();
    expect(screen.getByTestId('serviceName-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('port-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('username-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('password-password-input')).not.toBeDisabled();
  });

  it('should disable fields with not sat isRDS flag', async () => {
    const { container } = render(
      <Provider store={configureStore()}>
        <Form
          onSubmit={jest.fn()}
          render={({ form }) => <MainDetailsFormPart form={form} remoteInstanceCredentials={{ isRDS: false }} />}
        />
      </Provider>
    );

    const fields = container.querySelectorAll('input');
    await waitFor(() => expect(fields.length).toBe(8));

    expect(screen.getByTestId('address-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('serviceName-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('port-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('username-text-input')).not.toBeDisabled();
    expect(screen.getByTestId('password-password-input')).not.toBeDisabled();
  });
});

describe('ExternalServiceConnectionDetails ::', () => {
  it('should render', async () => {
    const { container } = render(
      <Provider store={configureStore()}>
        <Form
          onSubmit={jest.fn()}
          render={() => <ExternalServiceConnectionDetails form={form as unknown as FormApi} />}
        />
      </Provider>
    );

    const fields = container.querySelectorAll('input');
    expect(fields.length).toBe(5);
  });
});

describe('LabelsFormPart ::', () => {
  it('should render correct fields with empty props', async () => {
    const { container } = render(<Form onSubmit={jest.fn()} render={() => <LabelsFormPart />} />);

    const fields = container.querySelectorAll('input');
    const textArea = container.querySelectorAll('textarea');

    expect(fields.length).toBe(5);
    expect(textArea.length).toBe(1);
  });
});

describe('AdditionalOptionsFormPart ::', () => {
  it('should render correct for PostgreSQL instance', async () => {
    const type = Databases.postgresql;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    render(
      <Provider store={configureStore()}>
        <Form
          onSubmit={jest.fn()}
          render={() => (
            <AdditionalOptionsFormPart
              instanceType={type}
              remoteInstanceCredentials={remoteInstanceCredentials}
              loading={false}
              form={form as unknown as FormApi}
            />
          )}
        />
      </Provider>
    );

    expect(screen.getByTestId('skip_connection_check-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('tls-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('tls_skip_verify-checkbox-input')).toBeInTheDocument();
  });
});

describe('getAdditionalOptions ::', () => {
  it('should render correct for MongoDB', async () => {
    const type = Databases.mongodb;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const { container } = render(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = container.querySelectorAll('input');

    expect(screen.getByTestId('tls-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('tls_skip_verify-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('qan_mongodb_profiler-checkbox-input')).toBeInTheDocument();

    expect(fields.length).toBe(3);
  });
  it('should render correct for MySQL', async () => {
    const type = Databases.mysql;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const { container } = render(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = container.querySelectorAll('input');

    expect(screen.getByTestId('qan_mysql_perfschema-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('disable_comments_parsing-checkbox-input')).toBeInTheDocument();
    expect(fields.length).toBe(9);
  });
  it('should render correct for RDS MySQL', async () => {
    const type = Databases.mysql;
    const remoteInstanceCredentials = {
      isRDS: true,
    };

    const { container } = render(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = container.querySelectorAll('input');
    expect(screen.getByTestId('qan_mysql_perfschema-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('disable_comments_parsing-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('disable_basic_metrics-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('disable_enhanced_metrics-checkbox-input')).toBeInTheDocument();
    expect(fields.length).toBe(11);
  });
  it('should render correct for PostgreSQL', async () => {
    const type = Databases.postgresql;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const { container } = render(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = container.querySelectorAll('input');
    const trakingFields = screen.getAllByTestId('tracking-radio-button');
    expect(trakingFields.length).toBe(trackingOptions.length);
    expect(fields.length).toBe(16);
  });
  it('should render correct for RDS PostgreSQL', async () => {
    const type = Databases.postgresql;
    const remoteInstanceCredentials = {
      isRDS: true,
    };

    const { container } = render(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = container.querySelectorAll('input');
    const trakingFields = screen.getAllByTestId('tracking-radio-button');
    expect(trakingFields.length).toBe(rdsTrackingOptions.length);
    expect(fields.length).toBe(17);
  });
});
