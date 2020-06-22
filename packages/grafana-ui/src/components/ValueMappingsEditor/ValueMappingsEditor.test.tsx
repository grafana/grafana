import React from 'react';
import { mount } from 'enzyme';

import { ValueMappingsEditor, Props } from './ValueMappingsEditor';
import { MappingType } from '@grafana/data';

const setup = (spy?: any, propOverrides?: object) => {
  const props: Props = {
    onChange: (mappings: any) => {
      if (spy) {
        spy(mappings);
      }
    },
    valueMappings: [
      { id: 1, operator: '', type: MappingType.ValueToText, value: '20', text: 'Ok' },
      { id: 2, operator: '', type: MappingType.RangeToText, from: '21', to: '30', text: 'Meh' },
    ],
  };

  Object.assign(props, propOverrides);

  return mount(<ValueMappingsEditor {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    expect(setup).not.toThrow();
  });
});

describe('On remove mapping', () => {
  it('Should remove mapping at index 0', () => {
    const onChangeSpy = jest.fn();
    const wrapper = setup(onChangeSpy);
    const remove = wrapper.find('button[aria-label="ValueMappingsEditor remove button"]');
    remove.at(0).simulate('click');

    expect(onChangeSpy).toBeCalledWith([
      { id: 2, operator: '', type: MappingType.RangeToText, from: '21', to: '30', text: 'Meh' },
    ]);
  });

  it('should remove mapping at index 1', () => {
    const onChangeSpy = jest.fn();
    const wrapper = setup(onChangeSpy);

    const remove = wrapper.find('button[aria-label="ValueMappingsEditor remove button"]');
    remove.at(1).simulate('click');

    expect(onChangeSpy).toBeCalledWith([
      { id: 1, operator: '', type: MappingType.ValueToText, value: '20', text: 'Ok' },
    ]);
  });
});

describe('Next id to add', () => {
  it('should be 3', () => {
    const onChangeSpy = jest.fn();
    const wrapper = setup(onChangeSpy);

    const add = wrapper.find('*[aria-label="ValueMappingsEditor add mapping button"]');
    add.at(0).simulate('click');

    expect(onChangeSpy).toBeCalledWith([
      { id: 1, operator: '', type: MappingType.ValueToText, value: '20', text: 'Ok' },
      { id: 2, operator: '', type: MappingType.RangeToText, from: '21', to: '30', text: 'Meh' },
      { id: 3, operator: '', type: MappingType.ValueToText, from: '', to: '', text: '' },
    ]);
  });

  it('should default to 0', () => {
    const onChangeSpy = jest.fn();
    const wrapper = setup(onChangeSpy, { valueMappings: [] });
    const add = wrapper.find('*[aria-label="ValueMappingsEditor add mapping button"]');
    add.at(0).simulate('click');
    expect(onChangeSpy).toBeCalledWith([
      { id: 0, operator: '', type: MappingType.ValueToText, from: '', to: '', text: '' },
    ]);
  });
});
