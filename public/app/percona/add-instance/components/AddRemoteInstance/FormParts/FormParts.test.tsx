import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { FormApi, FormState } from 'final-form';
import { trackingOptions } from './FormParts.constants';
import { AdditionalOptionsFormPart, getAdditionalOptions } from './AdditionalOptions/AdditionalOptions';
import { LabelsFormPart } from './Labels/Labels';
import { MainDetailsFormPart } from './MainDetails/MainDetails';
import { ExternalServiceConnectionDetails } from './ExternalServiceConnectionDetails/ExternalServiceConnectionDetails';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { Databases } from 'app/percona/shared/core';

const form: Partial<FormApi> = {
  change: jest.fn(),
  getState: () => ({} as FormState<any>),
};

xdescribe('MainDetailsFormPart ::', () => {
  it('should disable fields with sat isRDS flag', async () => {
    const root = mount(
      <Form
        onSubmit={jest.fn()}
        render={({ form }) => <MainDetailsFormPart form={form} remoteInstanceCredentials={{ isRDS: true }} />}
      />
    );

    const fields = root.find('input');

    expect(fields.length).toBe(5);
    expect(root.find('input[name="address"]').prop('disabled')).toBeTruthy();
    expect(root.find('input[name="serviceName"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="port"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="username"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="password"]').prop('disabled')).toBeFalsy();
  });

  it('should disable fields with not sat isRDS flag', async () => {
    const root = mount(
      <Form
        onSubmit={jest.fn()}
        render={({ form }) => <MainDetailsFormPart form={form} remoteInstanceCredentials={{ isRDS: false }} />}
      />
    );

    const fields = root.find('input');

    expect(fields.length).toBe(5);
    expect(root.find('input[name="address"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="serviceName"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="port"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="username"]').prop('disabled')).toBeFalsy();
    expect(root.find('input[name="password"]').prop('disabled')).toBeFalsy();
  });
});

xdescribe('ExternalServiceConnectionDetails ::', () => {
  it('should render', async () => {
    const root = mount(
      <Form
        onSubmit={jest.fn()}
        render={() => <ExternalServiceConnectionDetails form={(form as unknown) as FormApi} />}
      />
    );

    const fields = root.find('input');

    expect(fields.length).toBe(5);
  });
});

xdescribe('LabelsFormPart ::', () => {
  it('should render correct fields with empty props', async () => {
    const root = mount(<Form onSubmit={jest.fn()} render={() => <LabelsFormPart />} />);

    const fields = root.find('input');
    const textArea = root.find('textarea');

    expect(fields.length).toBe(5);
    expect(textArea.length).toBe(1);
  });
});

xdescribe('AdditionalOptionsFormPart ::', () => {
  it('should render correct for PostgreSQL instance', async () => {
    const type = Databases.postgresql;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={() => (
          <AdditionalOptionsFormPart
            instanceType={type}
            remoteInstanceCredentials={remoteInstanceCredentials}
            loading={false}
            form={(form as unknown) as FormApi}
          />
        )}
      />
    );

    expect(root.find('input[name="skip_connection_check"]').length).toBe(1);
    expect(root.find('input[name="tls"]').length).toBe(1);
    expect(root.find('input[name="tls_skip_verify"]').length).toBe(1);
  });
});

xdescribe('getAdditionalOptions ::', () => {
  it('should render correct for MongoDB', async () => {
    const type = Databases.mongodb;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = root.find('input');

    expect(root.find('input[name="qan_mongodb_profiler"]').length).toBe(1);
    expect(fields.length).toBe(3);
  });

  it('should render correct for MySQL', async () => {
    const type = Databases.mysql;
    const remoteInstanceCredentials = {
      isRDS: false,
    };

    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = root.find('input');

    expect(root.find('input[name="qan_mysql_perfschema"]').length).toBe(1);
    expect(fields.length).toBe(8);
  });

  it('should render correct for RDS MySQL', async () => {
    const type = Databases.mysql;
    const remoteInstanceCredentials = {
      isRDS: true,
    };

    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = root.find('input');

    expect(root.find('input[name="qan_mysql_perfschema"]').length).toBe(1);
    expect(root.find('input[name="disable_basic_metrics"]').length).toBe(1);
    expect(root.find('input[name="disable_enhanced_metrics"]').length).toBe(1);
    expect(fields.length).toBe(10);
  });

  it('should render correct for PostgreSQL', async () => {
    const type = Databases.postgresql;
    const remoteInstanceCredentials = {
      isRDS: true,
    };

    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={() => getAdditionalOptions(type, remoteInstanceCredentials, form as FormApi)}
      />
    );
    const fields = root.find('input');

    expect(root.find('input[name="tracking"]').length).toBe(trackingOptions.length);
    expect(fields.length).toBe(7);
  });
});
