import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { PromQueryEditorByApp } from './PromQueryEditorByApp';
import { CoreApp } from '@grafana/data';
import { noop } from 'lodash';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { PrometheusDatasource } from '../datasource';
import { testIds as alertingTestIds } from './PromQueryEditorForAlerting';
import { testIds as regularTestIds } from './PromQueryEditor';

function setup(app: CoreApp): RenderResult {
  const dataSource = ({
    createQuery: jest.fn((q) => q),
    getInitHints: () => [],
    getPrometheusTime: jest.fn((date, roundup) => 123),
    languageProvider: {
      start: () => Promise.resolve([]),
      syntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
    exemplarErrors: new Observable().pipe(first()),
  } as unknown) as PrometheusDatasource;

  return render(
    <PromQueryEditorByApp
      app={app}
      onChange={noop}
      onRunQuery={noop}
      datasource={dataSource}
      query={{ refId: 'A', expr: '' }}
    />
  );
}

describe('PromQueryEditorByApp', () => {
  it('should render simplified query editor for cloud alerting', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.CloudAlerting);

    expect(getByTestId(alertingTestIds.editor)).toBeInTheDocument();
    expect(queryByTestId(regularTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for unkown apps', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Unknown);

    expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for explore', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Explore);

    expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for dashboard', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Dashboard);

    expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });
});
