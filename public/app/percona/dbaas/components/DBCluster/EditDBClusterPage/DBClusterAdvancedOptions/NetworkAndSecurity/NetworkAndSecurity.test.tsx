import { render, screen } from '@testing-library/react';
import arrayMutators from 'final-form-arrays';
import React from 'react';
import { Form } from 'react-final-form';

import { Messages } from '../DBClusterAdvancedOptions.messages';

import NetworkAndSecurity from './NetworkAndSecurity';
import { NetworkAndSecurityFields } from './NetworkAndSecurity.types';

describe('DBClusterAdvancedOptions NetworkAndSecurity::', () => {
  it('render items correctly for create mode', () => {
    render(
      <Form
        initialValues={{ [NetworkAndSecurityFields.sourceRanges]: [{}] }}
        onSubmit={jest.fn()}
        mutators={{ ...arrayMutators }}
        render={() => <NetworkAndSecurity mode="create" />}
      />
    );
    expect(screen.getByTestId('network-and-security').querySelector('legend')).toHaveTextContent(
      Messages.fieldSets.networkAndSecurity
    );
    expect(screen.getByTestId('expose-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('expose-checkbox-input')).not.toBeDisabled();
    expect(screen.getByTestId('expose-field-label')).toHaveTextContent(Messages.labels.expose);

    expect(screen.getByTestId('internetFacing-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('internetFacing-checkbox-input')).not.toBeDisabled();
    expect(screen.getByTestId('internetFacing-field-label')).toHaveTextContent(Messages.labels.internetFacing);

    expect(screen.getByTestId('network-and-security')).toHaveTextContent('Add new');
    expect(screen.getByTestId('sourceRanges[0].sourceRange-field-label')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).not.toBeDisabled();
  });

  it('render items correctly for edit mode', () => {
    render(
      <Form
        initialValues={{ [NetworkAndSecurityFields.sourceRanges]: [{}] }}
        onSubmit={jest.fn()}
        mutators={{ ...arrayMutators }}
        render={() => <NetworkAndSecurity mode="edit" />}
      />
    );
    expect(screen.getByTestId('network-and-security').querySelector('legend')).toHaveTextContent(
      Messages.fieldSets.networkAndSecurity
    );
    expect(screen.getByTestId('expose-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('expose-checkbox-input')).toBeDisabled();
    expect(screen.getByTestId('expose-field-label')).toHaveTextContent(Messages.labels.expose);

    expect(screen.getByTestId('internetFacing-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('internetFacing-checkbox-input')).toBeDisabled();
    expect(screen.getByTestId('internetFacing-field-label')).toHaveTextContent(Messages.labels.internetFacing);

    expect(screen.getByTestId('network-and-security')).toHaveTextContent('Add new');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-field-label')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeDisabled();
  });
});
