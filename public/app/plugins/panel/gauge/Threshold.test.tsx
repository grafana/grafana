import React from 'react';
import { shallow } from 'enzyme';
import Thresholds from './Thresholds';
import { defaultProps, OptionsProps } from './module';
import { PanelOptionsProps } from 'app/types';

const setup = (propOverrides?: object) => {
  const props: PanelOptionsProps<OptionsProps> = {
    onChange: jest.fn(),
    options: {
      ...defaultProps.options,
      thresholds: [],
    },
  };

  Object.assign(props, propOverrides);

  return shallow(<Thresholds {...props} />).instance() as Thresholds;
};

describe('Add threshold', () => {
  it('should add threshold', () => {
    const instance = setup();

    instance.onAddThreshold(0);

    expect(instance.state.thresholds).toEqual([{ index: 0, value: 50, color: 'rgb(127, 115, 64)' }]);
  });

  it('should add another threshold above a first', () => {
    const instance = setup({
      options: {
        ...defaultProps.options,
        thresholds: [{ index: 0, value: 50, color: 'rgb(127, 115, 64)' }],
      },
    });

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 0, value: 50, color: 'rgb(127, 115, 64)' },
      { index: 1, value: 75, color: 'rgb(170, 95, 61)' },
    ]);
  });
});

// describe('change threshold value', () => {
//   it('should update value and resort rows', () => {
//     const instance = setup();
//     const mockThresholds = [
//       { index: 0, label: 'Min', value: 0, canRemove: false, color: 'rgba(50, 172, 45, 0.97)' },
//       { index: 1, label: '', value: 50, canRemove: true, color: 'rgba(237, 129, 40, 0.89)' },
//       { index: 2, label: '', value: 75, canRemove: true, color: 'rgba(237, 129, 40, 0.89)' },
//       { index: 3, label: 'Max', value: 100, canRemove: false },
//     ];
//
//     instance.state = {
//       baseColor: BasicGaugeColor.Green,
//       thresholds: mockThresholds,
//     };
//
//     const mockEvent = { target: { value: 78 } };
//
//     instance.onChangeThresholdValue(mockEvent, mockThresholds[1]);
//
//     expect(instance.state.thresholds).toEqual([
//       { index: 0, label: 'Min', value: 0, canRemove: false, color: 'rgba(50, 172, 45, 0.97)' },
//       { index: 1, label: '', value: 78, canRemove: true, color: 'rgba(237, 129, 40, 0.89)' },
//       { index: 2, label: '', value: 75, canRemove: true, color: 'rgba(237, 129, 40, 0.89)' },
//       { index: 3, label: 'Max', value: 100, canRemove: false },
//     ]);
//   });
// });
