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

describe('Initialization', () => {
  it('should add a base threshold if missing', () => {
    const instance = setup();

    expect(instance.state.thresholds).toEqual([{ index: 0, value: -Infinity, color: '#299c46' }]);
  });
});

describe('Add threshold', () => {
  it('should add threshold', () => {
    const instance = setup();

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#299c46' },
    ]);
  });

  it('should add another threshold above a first', () => {
    const instance = setup({
      thresholds: [{ index: 0, value: -Infinity, color: '#299c46' }, { index: 1, value: 50, color: '#EAB839' }],
    });

    instance.onAddThreshold(2);

    expect(instance.state.thresholds).toEqual([
      { index: 2, value: 75, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#299c46' },
    ]);
  });

  it('should add another threshold between first and second index', () => {
    const instance = setup({
      thresholds: [
        { index: 0, value: -Infinity, color: '#299c46' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ],
    });

    instance.onAddThreshold(2);

    expect(instance.state.thresholds).toEqual([
      { index: 3, value: 75, color: '#EF843C' },
      { index: 2, value: 62.5, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#299c46' },
    ]);
  });
});

describe('change threshold value', () => {
  it('should update value and resort rows', () => {
    const instance = setup();
    const thresholds = [
      { index: 0, value: -Infinity, color: '#299c46' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];

    instance.state = {
      baseColor: BasicGaugeColor.Green,
      thresholds,
    };

    const mockEvent = { target: { value: 78 } };

    instance.onChangeThresholdValue(mockEvent, thresholds[1]);

    expect(instance.state.thresholds).toEqual([
      { index: 0, value: -Infinity, color: '#299c46' },
      { index: 1, value: 78, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ]);
  });
});
