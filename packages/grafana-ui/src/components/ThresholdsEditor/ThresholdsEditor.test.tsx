import React from 'react';
import { shallow } from 'enzyme';

import { ThresholdsEditor, Props } from './ThresholdsEditor';
import { BasicGaugeColor } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    onChange: jest.fn(),
    thresholds: [],
  };

  Object.assign(props, propOverrides);

  return shallow(<ThresholdsEditor {...props} />).instance() as ThresholdsEditor;
};

describe('Add threshold', () => {
  it('should add threshold', () => {
    const instance = setup();

    instance.onAddThreshold(0);

    expect(instance.state.thresholds).toEqual([{ index: 0, value: 50, color: 'rgb(127, 115, 64)' }]);
  });

  it('should add another threshold above a first', () => {
    const instance = setup({
      thresholds: [{ index: 0, value: 50, color: 'rgb(127, 115, 64)' }],
    });

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 1, value: 75, color: 'rgb(170, 95, 61)' },
      { index: 0, value: 50, color: 'rgb(127, 115, 64)' },
    ]);
  });
});

describe('change threshold value', () => {
  it('should update value and resort rows', () => {
    const instance = setup();
    const mockThresholds = [
      { index: 0, value: 50, color: 'rgba(237, 129, 40, 0.89)' },
      { index: 1, value: 75, color: 'rgba(237, 129, 40, 0.89)' },
    ];

    instance.state = {
      baseColor: BasicGaugeColor.Green,
      thresholds: mockThresholds,
    };

    const mockEvent = { target: { value: 78 } };

    instance.onChangeThresholdValue(mockEvent, mockThresholds[0]);

    expect(instance.state.thresholds).toEqual([
      { index: 0, value: 78, color: 'rgba(237, 129, 40, 0.89)' },
      { index: 1, value: 75, color: 'rgba(237, 129, 40, 0.89)' },
    ]);
  });
});
