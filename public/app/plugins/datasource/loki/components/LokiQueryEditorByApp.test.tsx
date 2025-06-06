import { render, RenderResult, screen } from '@testing-library/react';
import { noop } from 'lodash';

import { CoreApp } from '@grafana/data';

import { createLokiDatasource } from '../__mocks__/datasource';

import { testIds as regularTestIds } from './LokiQueryEditor';
import { LokiQueryEditorByApp } from './LokiQueryEditorByApp';
import { testIds as alertingTestIds } from './LokiQueryEditorForAlerting';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn().mockReturnValue({
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
  }),
}));

function setup(app: CoreApp): RenderResult {
  const dataSource = createLokiDatasource();
  dataSource.metadataRequest = jest.fn();

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
