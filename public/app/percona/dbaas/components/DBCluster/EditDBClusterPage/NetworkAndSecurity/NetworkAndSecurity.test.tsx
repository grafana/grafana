import { render, screen, fireEvent } from '@testing-library/react';
import arrayMutators from 'final-form-arrays';
import React from 'react';
import { Form } from 'react-final-form';

import NetworkAndSecurity from './NetworkAndSecurity';
import { Messages } from './NetworkAndSecurity.messages';
import { NetworkAndSecurityFields } from './NetworkAndSecurity.types';

describe('DBClusterAdvancedOptions NetworkAndSecurity::', () => {
  it('render items correctly for create and edit mode', () => {
    render(
      <Form
        initialValues={{ [NetworkAndSecurityFields.sourceRanges]: [{}] }}
        onSubmit={jest.fn()}
        mutators={{ ...arrayMutators }}
        render={({ form }) => <NetworkAndSecurity form={form} />}
      />
    );

    expect(screen.getByTestId('toggle-network-and-security')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-network-and-security');

    fireEvent.click(checkbox);

    expect(screen.getByTestId('network-and-security')).toHaveTextContent(Messages.fieldSets.expose);

    expect(screen.getByTestId('internetFacing-checkbox-input')).toBeInTheDocument();
    expect(screen.getByTestId('internetFacing-checkbox-input')).not.toBeDisabled();
    expect(screen.getByTestId('internetFacing-field-label')).toHaveTextContent(Messages.labels.internetFacing);

    expect(screen.getByTestId('network-and-security')).toHaveTextContent('Add new');
    expect(screen.getByTestId('sourceRanges[0].sourceRange-field-label')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).not.toBeDisabled();
  });
  it('the delete button should not delete the first field', () => {
    render(
      <Form
        initialValues={{ [NetworkAndSecurityFields.sourceRanges]: [{ sourceRange: '1' }] }}
        onSubmit={jest.fn()}
        mutators={{ ...arrayMutators }}
        render={({ form }) => <NetworkAndSecurity form={form} />}
      />
    );
    expect(screen.getByTestId('toggle-network-and-security')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-network-and-security');

    fireEvent.click(checkbox);

    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeInTheDocument();
    const deleteBtn = screen.getByTestId('deleteButton-0');
    fireEvent.click(deleteBtn);
    expect(screen.getByTestId('sourceRanges[0].sourceRange-text-input')).toBeInTheDocument();
  });
  it('the delete button should delete field from the form if it is not the first one ', () => {
    render(
      <Form
        initialValues={{ [NetworkAndSecurityFields.sourceRanges]: [{ sourceRange: '1' }, { sourceRange: '2' }] }}
        onSubmit={jest.fn()}
        mutators={{ ...arrayMutators }}
        render={({ form }) => <NetworkAndSecurity form={form} />}
      />
    );
    expect(screen.getByTestId('toggle-network-and-security')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-network-and-security');

    fireEvent.click(checkbox);

    expect(screen.getByTestId('sourceRanges[1].sourceRange-text-input')).toBeInTheDocument();
    const deleteBtn = screen.getByTestId('deleteButton-1');
    fireEvent.click(deleteBtn);
    expect(screen.queryByTestId('sourceRanges[1].sourceRange-text-input')).not.toBeInTheDocument();
  });
});
