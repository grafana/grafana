import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { CoreApp } from '@grafana/data';
import { noop } from 'lodash';
import { LokiDatasource } from '../datasource';
import { testIds as alertingTestIds } from './LokiQueryEditorForAlerting';
import { testIds as regularTestIds } from './LokiQueryEditor';
import LokiQueryEditorByApp from './LokiQueryEditorByApp';

function setup(app: CoreApp): RenderResult {
  const dataSource = ({
    languageProvider: {
      start: () => Promise.resolve([]),
      getSyntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
  } as unknown) as LokiDatasource;

  return render(
    <LokiQueryEditorByApp
      app={app}
      onChange={noop}
      onRunQuery={noop}
      datasource={dataSource}
      query={{ refId: 'A', expr: '' }}
    />
  );
}

describe('LokiQueryEditorByApp', () => {
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
