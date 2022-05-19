import { render, screen } from '@testing-library/react';
import React from 'react';

import { FuncInstance } from '../gfunc';

import { FunctionEditor } from './FunctionEditor';

function mockFunctionInstance(name: string, unknown?: boolean): FuncInstance {
  const def = {
    category: 'category',
    defaultParams: [],
    fake: false,
    name: name,
    params: [],
    unknown: unknown,
  };
  return new FuncInstance(def);
}

describe('FunctionEditor', () => {
  it('should display a defined function with name and no icon', () => {
    render(
      <FunctionEditor
        func={mockFunctionInstance('foo')}
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
        func={mockFunctionInstance('bar', true)}
        onMoveLeft={jest.fn()}
        onMoveRight={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
  });
});
