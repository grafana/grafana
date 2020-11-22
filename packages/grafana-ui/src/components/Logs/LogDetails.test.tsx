import React from 'react';
import { LogDetails, Props } from './LogDetails';
import { LogRowModel, LogLevel, GrafanaTheme, MutableDataFrame, Field } from '@grafana/data';
import { mount } from 'enzyme';
import { LogDetailsRow } from './LogDetailsRow';

const setup = (propOverrides?: Partial<Props>, rowOverrides?: Partial<LogRowModel>) => {
  const props: Props = {
    theme: {} as GrafanaTheme,
    showDuplicates: false,
    row: {
      dataFrame: new MutableDataFrame(),
      entryFieldIndex: 0,
      rowIndex: 0,
      logLevel: 'error' as LogLevel,
      timeFromNow: '',
      timeEpochMs: 1546297200000,
      timeEpochNs: '1546297200000000000',
      timeLocal: '',
      timeUtc: '',
      hasAnsi: false,
      entry: '',
      raw: '',
      uid: '0',
      labels: {},
      ...(rowOverrides || {}),
    },
    getRows: () => [],
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
    ...(propOverrides || {}),
  };

  return mount(<LogDetails {...props} />);
};

describe('LogDetails', () => {
  describe('when labels are present', () => {
    it('should render heading', () => {
      const wrapper = setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(wrapper.find({ 'aria-label': 'Log Labels' }).hostNodes()).toHaveLength(1);
    });
    it('should render labels', () => {
      const wrapper = setup(undefined, { labels: { key1: 'label1', key2: 'label2' } });
      expect(wrapper.text().includes('key1label1key2label2')).toBe(true);
    });
  });
  describe('when log row has error', () => {
    it('should not render log level border', () => {
      const wrapper = setup({ hasError: true }, undefined);
      expect(wrapper.find({ 'aria-label': 'Log level' }).html()).not.toContain('logs-row__level');
    });
  });
  describe('when row entry has parsable fields', () => {
    it('should render heading ', () => {
      const wrapper = setup(undefined, { entry: 'test=successful' });
      expect(wrapper.find({ title: 'Ad-hoc statistics' }).hostNodes()).toHaveLength(1);
    });
    it('should render parsed fields', () => {
      const wrapper = setup(undefined, { entry: 'test=successful' });
      expect(wrapper.text().includes('testsuccessful')).toBe(true);
    });
  });
  describe('when row entry have parsable fields and labels are present', () => {
    it('should render all headings', () => {
      const wrapper = setup(undefined, { entry: 'test=successful', labels: { key: 'label' } });
      expect(wrapper.find({ 'aria-label': 'Log Labels' })).toHaveLength(1);
      expect(wrapper.find({ 'aria-label': 'Parsed Fields' })).toHaveLength(1);
    });
    it('should render all labels and parsed fields', () => {
      const wrapper = setup(undefined, {
        entry: 'test=successful',
        labels: { key: 'label' },
      });
      expect(wrapper.text().includes('keylabel')).toBe(true);
      expect(wrapper.text().includes('testsuccessful')).toBe(true);
    });
  });
  describe('when row entry and labels are not present', () => {
    it('should render no details available message', () => {
      const wrapper = setup(undefined, { entry: '' });
      expect(wrapper.text().includes('No details available')).toBe(true);
    });
    it('should not render headings', () => {
      const wrapper = setup(undefined, { entry: '' });
      expect(wrapper.find({ 'aria-label': 'Log labels' })).toHaveLength(0);
      expect(wrapper.find({ 'aria-label': 'Parsed fields' })).toHaveLength(0);
    });
  });

  it('should render fields from dataframe with links', () => {
    const entry = 'traceId=1234 msg="some message"';
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'entry', values: [entry] },
        // As we have traceId in message already this will shadow it.
        {
          name: 'traceId',
          values: ['1234'],
          config: { links: [{ title: 'link', url: 'localhost:3210/${__value.text}' }] },
        },
        { name: 'userId', values: ['5678'] },
      ],
    });
    const wrapper = setup(
      {
        getFieldLinks: (field: Field, rowIndex: number) => {
          if (field.config && field.config.links) {
            return field.config.links.map(link => {
              return {
                href: link.url.replace('${__value.text}', field.values.get(rowIndex)),
                title: link.title,
                target: '_blank',
                origin: field,
              };
            });
          }
          return [];
        },
      },
      { entry, dataFrame, entryFieldIndex: 0, rowIndex: 0 }
    );
    expect(wrapper.find(LogDetailsRow).length).toBe(3);
    const traceIdRow = wrapper.find(LogDetailsRow).filter({ parsedKey: 'traceId' });
    expect(traceIdRow.length).toBe(1);
    expect(traceIdRow.find('a').hostNodes().length).toBe(1);
    expect((traceIdRow.find('a').getDOMNode() as HTMLAnchorElement).href).toBe('localhost:3210/1234');
  });
});
