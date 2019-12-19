import React from 'react';
import { LogDetailsRow, Props } from './LogDetailsRow';
import { GrafanaTheme } from '@grafana/data';
import { mount } from 'enzyme';
import { LogLabelStats } from './LogLabelStats';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    theme: {} as GrafanaTheme,
    parsedValue: '',
    parsedKey: '',
    isLabel: true,
    getStats: () => null,
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<LogDetailsRow {...props} />);
  return wrapper;
};

describe('LogDetailsRow', () => {
  it('should render parsed key', () => {
    const wrapper = setup({ parsedKey: 'test key' });
    expect(wrapper.text().includes('test key')).toBe(true);
  });
  it('should render parsed value', () => {
    const wrapper = setup({ parsedValue: 'test value' });
    expect(wrapper.text().includes('test value')).toBe(true);
  });
  it('should render metrics button', () => {
    const wrapper = setup();
    expect(wrapper.find('i.fa-signal')).toHaveLength(1);
  });
  describe('if props is a label', () => {
    it('should render filter label button', () => {
      const wrapper = setup();
      expect(wrapper.find('i.fa-search-plus')).toHaveLength(1);
    });
    it('should render filter out label button', () => {
      const wrapper = setup();
      expect(wrapper.find('i.fa-search-minus')).toHaveLength(1);
    });
  });

  it('should render stats when stats icon is clicked', () => {
    const wrapper = setup({
      parsedKey: 'key',
      parsedValue: 'value',
      getStats: () => {
        return [
          {
            count: 1,
            proportion: 1 / 2,
            value: 'value',
          },
          {
            count: 1,
            proportion: 1 / 2,
            value: 'another value',
          },
        ];
      },
    });

    expect(wrapper.find(LogLabelStats).length).toBe(0);
    wrapper.find({ title: 'Ad-hoc statistics' }).simulate('click');
    expect(wrapper.find(LogLabelStats).length).toBe(1);
    expect(wrapper.find(LogLabelStats).contains('another value')).toBeTruthy();
  });
});
