import React from 'react';
import { LogDetails, Props } from './LogDetails';
import { LogRowModel, LogLevel } from '@grafana/data';
import { mount } from 'enzyme';
import { GrafanaTheme } from '../../types/theme';

const setup = (propOverrides?: object) => {
  const props: Props = {
    theme: {} as GrafanaTheme,
    row: {
      logLevel: 'error' as LogLevel,
      timeFromNow: '',
      timeEpochMs: 1546297200000,
      timeLocal: '',
      timeUtc: '',
      hasAnsi: false,
      entry: '',
      raw: '',
      timestamp: '',
      uid: '0',
    } as LogRowModel,
    getRows: () => [],
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<LogDetails {...props} />);
  return wrapper;
};

describe('LogDetails', () => {
  describe('when labels are present', () => {
    it('should render heading and labels', () => {
      const wrapper = setup({ row: { labels: { key1: 'label1', key2: 'label2' } } });
      expect(wrapper.text().includes('Log Labels:key1label1key2label2')).toBe(true);
    });
  }),
    describe('when row entry has parsable fields', () => {
      it('should render heading and parsed fields', () => {
        const wrapper = setup({ row: { entry: 'test1=successful1 test2=successful2' } });
        expect(wrapper.text().includes('Parsed fields:test1successful1test2successful2')).toBe(true);
      });
    }),
    describe('when row entry have parsable fields and labels are present', () => {
      it('should render headings,labels and parsed fields', () => {
        const wrapper = setup({ row: { entry: 'test1=successful1', labels: { key1: 'label1' } } });
        expect(wrapper.text().includes('Log Labels:key1label1')).toBe(true);
        expect(wrapper.text().includes('Parsed fields:test1successful1')).toBe(true);
      });
    }),
    describe('when row entry and labels are not present', () => {
      it('should render no details available message', () => {
        const wrapper = setup();
        expect(wrapper.text().includes('No details available')).toBe(true);
      });
    });
});
