import { render } from '@testing-library/react';
import React from 'react';

import { EventBusSrv, TimeRange, toUtc } from '@grafana/data';
import { setBackendSrv, TemplateSrv } from '@grafana/runtime';
import { BackendSrv } from 'app/core/services/backend_srv';
import { ContextSrv } from 'app/core/services/context_srv';

import { createLokiDatasource } from '../mocks';
import { LokiQuery } from '../types';

import { LokiQueryEditor } from './LokiQueryEditor';

const createMockRequestRange = (from: string, to: string): TimeRange => {
  return {
    from: toUtc(from, 'YYYY-MM-DD'),
    to: toUtc(to, 'YYYY-MM-DD'),
    raw: {
      from: toUtc(from, 'YYYY-MM-DD'),
      to: toUtc(to, 'YYYY-MM-DD'),
    },
  };
};

const setup = (propOverrides?: object) => {
  const mockTemplateSrv: TemplateSrv = {
    getVariables: jest.fn(),
    replace: jest.fn(),
    containsTemplate: jest.fn(),
    updateTimeRange: jest.fn(),
  };
  const datasource = createLokiDatasource(mockTemplateSrv);
  const onRunQuery = jest.fn();
  const onChange = jest.fn();

  const query: LokiQuery = {
    expr: '',
    refId: 'A',
    legendFormat: 'My Legend',
  };

  const range = createMockRequestRange('2020-01-01', '2020-01-02');

  const props = {
    datasource,
    onChange,
    onRunQuery,
    query,
    range,
  };

  Object.assign(props, propOverrides);

  render(<LokiQueryEditor {...props} />);
};

beforeAll(() => {
  const mockedBackendSrv = new BackendSrv({
    fromFetch: jest.fn(),
    appEvents: new EventBusSrv(),
    contextSrv: new ContextSrv(),
    logout: jest.fn(),
  });

  setBackendSrv(mockedBackendSrv);
});

describe('LokiQueryEditor', () => {
  it('should render without throwing', () => {
    expect(() => setup()).not.toThrow();
  });
});
