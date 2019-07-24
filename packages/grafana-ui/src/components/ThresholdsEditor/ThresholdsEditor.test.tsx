import React, { ChangeEvent } from 'react';
import { mount } from 'enzyme';
import { ThresholdsEditor, Props, thresholdsWithoutKey } from './ThresholdsEditor';
import { colors } from '../../utils';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    onChange: jest.fn(),
    thresholds: [],
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<ThresholdsEditor {...props} />);
  const instance = wrapper.instance() as ThresholdsEditor;

  return {
    instance,
    wrapper,
  };
};

function getCurrentThresholds(editor: ThresholdsEditor) {
  return thresholdsWithoutKey(editor.state.thresholds);
}

describe('Render', () => {
  it('should render with base threshold', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Initialization', () => {
  it('should add a base threshold if missing', () => {
    const { instance } = setup();

    expect(getCurrentThresholds(instance)).toEqual([{ value: -Infinity, color: colors[0] }]);
  });
});

describe('Add threshold', () => {
  it('should add threshold', () => {
    const { instance } = setup();

    instance.onAddThresholdAfter(instance.state.thresholds[0]);

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: colors[0] }, // 0
      { value: 50, color: colors[2] }, // 1
    ]);
  });

  it('should add another threshold above a first', () => {
    const { instance } = setup({
      thresholds: [
        { value: -Infinity, color: colors[0] }, // 0
        { value: 50, color: colors[2] }, // 1
      ],
    });

    instance.onAddThresholdAfter(instance.state.thresholds[1]);

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: colors[0] }, // 0
      { value: 50, color: colors[2] }, // 1
      { value: 75, color: colors[3] }, // 2
    ]);
  });

  it('should add another threshold between first and second index', () => {
    const { instance } = setup({
      thresholds: [
        { value: -Infinity, color: colors[0] },
        { value: 50, color: colors[2] },
        { value: 75, color: colors[3] },
      ],
    });

    instance.onAddThresholdAfter(instance.state.thresholds[1]);

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: colors[0] },
      { value: 50, color: colors[2] },
      { value: 62.5, color: colors[4] },
      { value: 75, color: colors[3] },
    ]);
  });
});

describe('Remove threshold', () => {
  it('should not remove threshold at index 0', () => {
    const thresholds = [
      { value: -Infinity, color: '#7EB26D' },
      { value: 50, color: '#EAB839' },
      { value: 75, color: '#6ED0E0' },
    ];
    const { instance } = setup({ thresholds });

    instance.onRemoveThreshold(instance.state.thresholds[0]);

    expect(getCurrentThresholds(instance)).toEqual(thresholds);
  });

  it('should remove threshold', () => {
    const thresholds = [
      { value: -Infinity, color: '#7EB26D' },
      { value: 50, color: '#EAB839' },
      { value: 75, color: '#6ED0E0' },
    ];
    const { instance } = setup({ thresholds });

    instance.onRemoveThreshold(instance.state.thresholds[1]);

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: '#7EB26D' },
      { value: 75, color: '#6ED0E0' },
    ]);
  });
});

describe('change threshold value', () => {
  it('should not change threshold at index 0', () => {
    const thresholds = [
      { value: -Infinity, color: '#7EB26D' },
      { value: 50, color: '#EAB839' },
      { value: 75, color: '#6ED0E0' },
    ];
    const { instance } = setup({ thresholds });

    const mockEvent = ({ target: { value: '12' } } as any) as ChangeEvent<HTMLInputElement>;

    instance.onChangeThresholdValue(mockEvent, instance.state.thresholds[0]);

    expect(getCurrentThresholds(instance)).toEqual(thresholds);
  });

  it('should update value', () => {
    const { instance } = setup();
    const thresholds = [
      { value: -Infinity, color: '#7EB26D', key: 1 },
      { value: 50, color: '#EAB839', key: 2 },
      { value: 75, color: '#6ED0E0', key: 3 },
    ];

    instance.state = {
      thresholds,
    };

    const mockEvent = ({ target: { value: '78' } } as any) as ChangeEvent<HTMLInputElement>;

    instance.onChangeThresholdValue(mockEvent, thresholds[1]);

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: '#7EB26D' },
      { value: 78, color: '#EAB839' },
      { value: 75, color: '#6ED0E0' },
    ]);
  });
});

describe('on blur threshold value', () => {
  it('should resort rows and update indexes', () => {
    const { instance } = setup();
    const thresholds = [
      { value: -Infinity, color: '#7EB26D', key: 1 },
      { value: 78, color: '#EAB839', key: 2 },
      { value: 75, color: '#6ED0E0', key: 3 },
    ];

    instance.setState({
      thresholds,
    });

    instance.onBlur();

    expect(getCurrentThresholds(instance)).toEqual([
      { value: -Infinity, color: '#7EB26D' },
      { value: 75, color: '#6ED0E0' },
      { value: 78, color: '#EAB839' },
    ]);
  });
});
