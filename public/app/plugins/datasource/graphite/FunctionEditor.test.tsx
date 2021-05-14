import React from 'react';
import { render, screen } from '@testing-library/react';
import { FunctionEditor } from './FunctionEditor';
import { FunctionDescriptor } from './FunctionEditorControls';

function mockFunctionDescriptor(name: string, unknown?: boolean): FunctionDescriptor {
  return {
    text: '',
    params: [],
    def: {
      category: 'category',
      defaultParams: [],
      fake: false,
      name: name,
      params: [],
      unknown: unknown,
    },
  };
}

describe('FunctionEditor', () => {
  it('should display a defined function with name and no icon', () => {
    render(
      <FunctionEditor
        func={mockFunctionDescriptor('foo')}
        onMoveLeft={() => {}}
        onMoveRight={() => {}}
        onRemove={() => {}}
      />
    );

    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.queryByTestId('warning-icon')).not.toBeInTheDocument();
  });

  it('should display an unknown function with name and warning icon', () => {
    render(
      <FunctionEditor
        func={mockFunctionDescriptor('bar', true)}
        onMoveLeft={jest.fn()}
        onMoveRight={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
  });
});
