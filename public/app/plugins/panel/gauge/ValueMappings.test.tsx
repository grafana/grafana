import React from 'react';
import { shallow } from 'enzyme';
import { GaugeOptions, MappingType, PanelOptionsProps } from '@grafana/ui';
import { defaultProps } from 'app/plugins/panel/gauge/GaugePanelOptions';

import ValueMappings from './ValueMappings';

const setup = (propOverrides?: object) => {
  const props: PanelOptionsProps<GaugeOptions> = {
    onChange: jest.fn(),
    options: {
      ...defaultProps.options,
      mappings: [
        { id: 1, operator: '', type: MappingType.ValueToText, value: '20', text: 'Ok' },
        { id: 2, operator: '', type: MappingType.RangeToText, from: '21', to: '30', text: 'Meh' },
      ],
    },
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ValueMappings {...props} />);

  const instance = wrapper.instance() as ValueMappings;

  return {
    instance,
    wrapper,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });
});

describe('On remove mapping', () => {
  it('Should remove mapping with id 0', () => {
    const { instance } = setup();
    instance.onRemoveMapping(1);

    expect(instance.state.mappings).toEqual([
      { id: 2, operator: '', type: MappingType.RangeToText, from: '21', to: '30', text: 'Meh' },
    ]);
  });

  it('should remove mapping with id 1', () => {
    const { instance } = setup();
    instance.onRemoveMapping(2);

    expect(instance.state.mappings).toEqual([
      { id: 1, operator: '', type: MappingType.ValueToText, value: '20', text: 'Ok' },
    ]);
  });
});

describe('Next id to add', () => {
  it('should be 4', () => {
    const { instance } = setup();

    instance.addMapping();

    expect(instance.state.nextIdToAdd).toEqual(4);
  });

  it('should default to 1', () => {
    const { instance } = setup({ options: { ...defaultProps.options } });

    expect(instance.state.nextIdToAdd).toEqual(1);
  });
});
