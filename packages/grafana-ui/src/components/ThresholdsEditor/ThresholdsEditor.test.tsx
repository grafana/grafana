import React from 'react';
import { shallow } from 'enzyme';

import { ThresholdsEditor, Props } from './ThresholdsEditor';

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

    expect(instance.state.thresholds).toEqual([{ index: 0, value: -Infinity, color: '#7EB26D' }]);
  });
});

describe('Add threshold', () => {
  it('should not add threshold at index 0', () => {
    const instance = setup();

    instance.onAddThreshold(0);

    expect(instance.state.thresholds).toEqual([{ index: 0, value: -Infinity, color: '#7EB26D' }]);
  });

  it('should add threshold', () => {
    const instance = setup();

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ]);
  });

  it('should add another threshold above a first', () => {
    const instance = setup({
      thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }, { index: 1, value: 50, color: '#EAB839' }],
    });

    instance.onAddThreshold(2);

    expect(instance.state.thresholds).toEqual([
      { index: 2, value: 75, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ]);
  });

  it('should add another threshold between first and second index', () => {
    const instance = setup({
      thresholds: [
        { index: 0, value: -Infinity, color: '#7EB26D' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ],
    });

    instance.onAddThreshold(2);

    expect(instance.state.thresholds).toEqual([
      { index: 3, value: 75, color: '#6ED0E0' },
      { index: 2, value: 62.5, color: '#EF843C' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ]);
  });
});

describe('Remove threshold', () => {
  it('should not remove threshold at index 0', () => {
    const thresholds = [
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];
    const instance = setup({ thresholds });

    instance.onRemoveThreshold(thresholds[0]);

    expect(instance.state.thresholds).toEqual(thresholds);
  });

  it('should remove threshold', () => {
    const thresholds = [
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];
    const instance = setup({
      thresholds,
    });

    instance.onRemoveThreshold(thresholds[1]);

    expect(instance.state.thresholds).toEqual([
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 75, color: '#6ED0E0' },
    ]);
  });
});

describe('change threshold value', () => {
  it('should not change threshold at index 0', () => {
    const thresholds = [
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];
    const instance = setup({ thresholds });

    const mockEvent = { target: { value: 12 } };

    instance.onChangeThresholdValue(mockEvent, thresholds[0]);

    expect(instance.state.thresholds).toEqual(thresholds);
  });

  it('should update value', () => {
    const instance = setup();
    const thresholds = [
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];

    instance.state = {
      thresholds,
    };

    const mockEvent = { target: { value: 78 } };

    instance.onChangeThresholdValue(mockEvent, thresholds[1]);

    expect(instance.state.thresholds).toEqual([
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 78, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ]);
  });
});

describe('on blur threshold value', () => {
  it('should resort rows and update indexes', () => {
    const instance = setup();
    const thresholds = [
      { index: 0, value: -Infinity, color: '#7EB26D' },
      { index: 1, value: 78, color: '#EAB839' },
      { index: 2, value: 75, color: '#6ED0E0' },
    ];

    instance.state = {
      thresholds,
    };

    instance.onBlur();

    expect(instance.state.thresholds).toEqual([
      { index: 2, value: 78, color: '#EAB839' },
      { index: 1, value: 75, color: '#6ED0E0' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ]);
  });
});
