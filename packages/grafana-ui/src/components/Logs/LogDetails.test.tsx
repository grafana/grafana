import React from 'react';
import { LogDetails, Props } from './LogDetails';
import { LogRowModel, LogLevel, GrafanaTheme } from '@grafana/data';
import { mount } from 'enzyme';

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
    it('should render heading', () => {
      const wrapper = setup({ row: { labels: { key1: 'label1', key2: 'label2' } } });
      expect(wrapper.find({ 'aria-label': 'Log labels' })).toHaveLength(1);
    }),
      it('should render labels', () => {
        const wrapper = setup({ row: { labels: { key1: 'label1', key2: 'label2' } } });
        expect(wrapper.text().includes('key1label1key2label2')).toBe(true);
      });
  }),
    describe('when row entry has parsable fields', () => {
      it('should render heading ', () => {
        const wrapper = setup({ row: { entry: 'test=successful' } });
        expect(wrapper.find({ 'aria-label': 'Parsed fields' })).toHaveLength(1);
      }),
        it('should render parsed fields', () => {
          const wrapper = setup({
            row: { entry: 'test=successful' },
            parser: {
              getLabelFromField: () => 'test',
              getValueFromField: () => 'successful',
            },
          });
          expect(wrapper.text().includes('testsuccessful')).toBe(true);
        });
    }),
    describe('when row entry have parsable fields and labels are present', () => {
      it('should render all headings', () => {
        const wrapper = setup({ row: { entry: 'test=successful', labels: { key: 'label' } } });
        expect(wrapper.find({ 'aria-label': 'Log labels' })).toHaveLength(1);
        expect(wrapper.find({ 'aria-label': 'Parsed fields' })).toHaveLength(1);
      }),
        it('should render all labels and parsed fields', () => {
          const wrapper = setup({
            row: { entry: 'test=successful', labels: { key: 'label' } },
            parser: {
              getLabelFromField: () => 'test',
              getValueFromField: () => 'successful',
            },
          });
          expect(wrapper.text().includes('keylabel')).toBe(true);
          expect(wrapper.text().includes('testsuccessful')).toBe(true);
        });
    }),
    describe('when row entry and labels are not present', () => {
      it('should render no details available message', () => {
        const wrapper = setup({ parsedFields: [] });
        expect(wrapper.text().includes('No details available')).toBe(true);
      }),
        it('should not render headings', () => {
          const wrapper = setup({ parsedFields: [] });
          expect(wrapper.find({ 'aria-label': 'Log labels' })).toHaveLength(0);
          expect(wrapper.find({ 'aria-label': 'Parsed fields' })).toHaveLength(0);
        });
    });
});
