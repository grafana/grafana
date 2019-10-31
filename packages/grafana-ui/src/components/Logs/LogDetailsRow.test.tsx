import React from 'react';
import { LogDetailsRow, Props } from './LogDetailsRow';
import { LogRowModel, LogsParser, GrafanaTheme } from '@grafana/data';
import { mount } from 'enzyme';

const setup = (propOverrides?: object) => {
  const props: Props = {
    theme: {} as GrafanaTheme,
    parsedValue: '',
    parsedKey: '',
    field: '',
    isLabel: true,
    parser: {} as LogsParser,
    row: {} as LogRowModel,
    getRows: () => [],
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
  }),
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
    }),
      it('should render filte out label button', () => {
        const wrapper = setup();
        expect(wrapper.find('i.fa-search-minus')).toHaveLength(1);
      });
  });
});
