import { render, RenderResult, screen } from '@testing-library/react';
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
    maxLines: 20,
    getTimeRange: jest.fn(),
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
  it('should render simplified query editor for cloud alerting', async () => {
    setup(CoreApp.CloudAlerting);

    expect(await screen.findByTestId(alertingTestIds.editor)).toBeInTheDocument();
    expect(screen.queryByTestId(regularTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for unknown apps', async () => {
    setup(CoreApp.Unknown);
    expect(await screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for explore', async () => {
    setup(CoreApp.Explore);

    expect(await screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render regular query editor for dashboard', async () => {
    setup(CoreApp.Dashboard);

    expect(await screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });
});
