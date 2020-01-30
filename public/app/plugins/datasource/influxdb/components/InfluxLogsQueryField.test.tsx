import React from 'react';
import { mount } from 'enzyme';
import { InfluxLogsQueryField, pairsAreValid } from './InfluxLogsQueryField';
import { InfluxDatasourceMock } from '../datasource.mock';
import InfluxDatasource from '../datasource';
import { InfluxQuery } from '../types';
import { ButtonCascader } from '@grafana/ui';

describe('pairsAreValid()', () => {
  describe('when all pairs are fully defined', () => {
    it('should return true', () => {
      const pairs = [
        {
          key: 'a',
          operator: '=',
          value: '1',
        },
        {
          key: 'b',
          operator: '!=',
          value: '2',
        },
      ];

      expect(pairsAreValid(pairs as any)).toBe(true);
    });
  });

  describe('when no pairs are defined at all', () => {
    it('should return true', () => {
      expect(pairsAreValid([])).toBe(true);
    });
  });

  describe('when pairs are undefined', () => {
    it('should return true', () => {
      expect(pairsAreValid(undefined)).toBe(true);
    });
  });

  describe('when one or more pairs are only partially defined', () => {
    it('should return false', () => {
      const pairs = [
        {
          key: 'a',
          operator: undefined,
          value: '1',
        },
        {
          key: 'b',
          operator: '!=',
          value: '2',
        },
      ];

      expect(pairsAreValid(pairs as any)).toBe(false);
    });
  });
});

describe('InfluxLogsQueryField', () => {
  it('should load and show correct measurements and fields in cascader', async () => {
    const wrapper = getInfluxLogsQueryField();
    // Looks strange but we do async stuff in didMount and this will push the stack at the end of eval loop, effectively
    // waiting for the didMount to finish.
    await Promise.resolve();
    wrapper.update();
    const cascader = wrapper.find(ButtonCascader);
    expect(cascader.prop('options')).toEqual([
      { label: 'logs', value: 'logs', children: [{ label: 'description', value: 'description', children: [] }] },
    ]);
  });
});

function getInfluxLogsQueryField(props?: any) {
  const datasource: InfluxDatasource = new InfluxDatasourceMock(
    props?.measurements || {
      logs: [{ name: 'description', type: 'string' }],
    }
  ) as any;

  const defaultProps = {
    datasource,
    history: [] as any[],
    onRunQuery: () => {},
    onChange: (query: InfluxQuery) => {},
    query: {
      refId: '',
    } as InfluxQuery,
  };
  return mount(
    <InfluxLogsQueryField
      {...{
        ...defaultProps,
        ...props,
      }}
    />
  );
}
