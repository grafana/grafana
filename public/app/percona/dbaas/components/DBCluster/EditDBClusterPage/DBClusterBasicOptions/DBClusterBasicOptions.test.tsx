import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { kubernetesStub } from '../../../Kubernetes/__mocks__/kubernetesStubs';
import { Messages } from '../EditDBClusterPage.messages';

import { DBClusterBasicOptions } from './DBClusterBasicOptions';
import { BasicOptionsFields } from './DBClusterBasicOptions.types';
import { kubernetesClusterNameValidator } from './DBClusterBasicOptions.utils';

describe('DBClusterBasicOptions::', () => {
  it('renders correctly', () => {
    render(
      <Form
        onSubmit={jest.fn()}
        render={({ form }: FormRenderProps) => <DBClusterBasicOptions kubernetes={kubernetesStub} form={form} />}
      />
    );

    expect(screen.getByTestId('name-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-kubernetes-cluster-field')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-database-type-field')).toBeInTheDocument();
    const databaseVersionField = screen.getByTestId('dbcluster-database-version-field');
    expect(databaseVersionField).toBeInTheDocument();
    expect(databaseVersionField.querySelector('input')).toBeDisabled();
  });

  it('renders correctly with default values', () => {
    render(
      <Form
        initialValues={{
          [BasicOptionsFields.name]: 'dbcluster',
        }}
        onSubmit={jest.fn()}
        render={({ form }: FormRenderProps) => <DBClusterBasicOptions kubernetes={kubernetesStub} form={form} />}
      />
    );
    expect(screen.getByTestId('name-text-input')).toHaveValue('dbcluster');
  });

  it('should validate cluster name correctly', () => {
    const clusterName1 = '!!!!';
    const clusterName2 = '1bcd';
    const clusterName3 = 'abcd';

    expect(kubernetesClusterNameValidator(clusterName1)).toEqual(Messages.validationMessages.clusterName);
    expect(kubernetesClusterNameValidator(clusterName2)).toEqual(Messages.validationMessages.clusterName);
    expect(kubernetesClusterNameValidator(clusterName3)).toEqual(undefined);
  });

  it('should validate cluster name length', () => {
    render(
      <Form
        initialValues={{
          [BasicOptionsFields.name]: 'testname',
        }}
        onSubmit={jest.fn()}
        render={({ form }: FormRenderProps) => <DBClusterBasicOptions kubernetes={kubernetesStub} form={form} />}
      />
    );

    const name = screen.getByTestId('name-text-input');
    fireEvent.change(name, { target: { value: 'testinvalidnamelength' } });

    expect(screen.getByTestId('name-field-error-message').textContent?.length).toBeGreaterThan(0);
  });
});
