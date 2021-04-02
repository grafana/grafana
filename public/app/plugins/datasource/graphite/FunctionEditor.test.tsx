import React from 'react';
import { mount } from 'enzyme';
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
    const component = mount(
      <FunctionEditor
        func={mockFunctionDescriptor('foo')}
        onMoveLeft={jest.fn()}
        onMoveRight={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    const label = component.find('span');
    expect(label.text()).toEqual('foo');

    const icon = component.find('Icon');
    expect(icon).toHaveLength(0);
  });

  it('should display an unknown function with name and warning icon', () => {
    const component = mount(
      <FunctionEditor
        func={mockFunctionDescriptor('bar', true)}
        onMoveLeft={jest.fn()}
        onMoveRight={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    const label = component.find('span');
    expect(label.text()).toEqual('bar');

    const icon = component.find('Icon');
    expect(icon).toHaveLength(1);
  });
});
