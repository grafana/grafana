import { render, RenderResult, waitFor } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';

import { CoreApp } from '@grafana/data';

import { LokiDatasource } from '../datasource';

import { testIds as regularTestIds } from './LokiQueryEditor';
import { LokiQueryEditorByApp } from './LokiQueryEditorByApp';
import { testIds as alertingTestIds } from './LokiQueryEditorForAlerting';

function setup(app: CoreApp): RenderResult {
  const dataSource = {
    languageProvider: {
      start: () => Promise.resolve([]),
      getSyntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
    getQueryHints: () => [],
    getDataSamples: () => [],
  } as unknown as LokiDatasource;

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

  it('should render regular query editor for unknown apps', async () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Unknown);
    expect(await waitFor(() => getByTestId(regularTestIds.editor))).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for explore', async () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Explore);

    expect(await waitFor(() => getByTestId(regularTestIds.editor))).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for dashboard', async () => {
    const { findByTestId, queryByTestId } = setup(CoreApp.Dashboard);

    expect(await findByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });
});
