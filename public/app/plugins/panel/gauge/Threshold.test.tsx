import React from 'react';
import { shallow } from 'enzyme';
import Thresholds from './Thresholds';
import { OptionsProps } from './module';
import { PanelOptionsProps } from '../../../types';

const setup = (propOverrides?: object) => {
  const props: PanelOptionsProps<OptionsProps> = {
    onChange: jest.fn(),
    options: {} as OptionsProps,
  };

  Object.assign(props, propOverrides);

  return shallow(<Thresholds {...props} />).instance() as Thresholds;
};

describe('Add threshold', () => {
  it('should add treshold between min and max', () => {
    const instance = setup();

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 0, label: 'Min', value: 0, canRemove: false },
      { index: 1, label: '', value: 0, canRemove: true },
      { index: 2, label: 'Max', value: 100, canRemove: false },
    ]);
  });

  it('should add threshold between min and added threshold', () => {
    const instance = setup();

    instance.state = {
      thresholds: [
        { index: 0, label: 'Min', value: 0, canRemove: false },
        { index: 1, label: '', value: 50, canRemove: true },
        { index: 2, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 1,
    };

    instance.onAddThreshold(1);

    expect(instance.state.thresholds).toEqual([
      { index: 0, label: 'Min', value: 0, canRemove: false },
      { index: 1, label: '', value: 0, canRemove: true },
      { index: 2, label: '', value: 50, canRemove: true },
      { index: 3, label: 'Max', value: 100, canRemove: false },
    ]);
  });
});

describe('Add at index', () => {
  it('should return 1, no added thresholds', () => {
    const instance = setup();

    const result = instance.insertAtIndex(1);

    expect(result).toEqual(1);
  });

  it('should return 1, one added threshold', () => {
    const instance = setup();
    instance.state = {
      thresholds: [
        { index: 0, label: 'Min', value: 0, canRemove: false },
        { index: 1, label: '', value: 50, canRemove: true },
        { index: 2, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 1,
    };

    const result = instance.insertAtIndex(1);

    expect(result).toEqual(1);
  });

  it('should return 2, two added thresholds', () => {
    const instance = setup();
    instance.state = {
      thresholds: [
        { index: 0, label: 'Min', value: 0, canRemove: false },
        { index: 1, label: '', value: 25, canRemove: true },
        { index: 2, label: '', value: 50, canRemove: true },
        { index: 3, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 2,
    };

    const result = instance.insertAtIndex(2);

    expect(result).toEqual(2);
  });

  it('should return 2, one added threshold', () => {
    const instance = setup();
    instance.state = {
      thresholds: [
        { index: 0, label: 'Min', value: 0, canRemove: false },
        { index: 1, label: '', value: 50, canRemove: true },
        { index: 2, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 1,
    };

    const result = instance.insertAtIndex(2);

    expect(result).toEqual(2);
  });
});
