import { render, screen, waitFor } from '@testing-library/react';

import { AbsoluteTimeRange, EventBusSrv, FieldConfigSource, LoadingState, PanelData, toUtc } from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { Options } from 'app/plugins/panel/logstable/options/types';

import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

import { ExploreLogsTable } from './ExploreLogsTable';
import { getMockLokiFrame } from './utils/mocks';

// Mock TableNG to disable virtualization, otherwise the lack of viewport in our testing env will cause the table to only render a single column
jest.mock('@grafana/ui/unstable', () => {
  const actual = jest.requireActual('@grafana/ui/unstable');
  const MockTableNG = actual.TableNG;
  return {
    ...actual,
    TableNG: (props: React.ComponentProps<typeof MockTableNG>) => (
      <MockTableNG {...props} enableVirtualization={false} />
    ),
  };
});

const publishMockFn = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: publishMockFn,
  })),
}));

describe('ExploreLogsTable', () => {
  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer, extractFieldsTransformer]);
  });

  const panelData: PanelData = {
    state: LoadingState.Loading,
    series: [getMockLokiFrame()],
    timeRange: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: { from: 'now-1h', to: 'now' },
    },
  };

  const buildLinkToLogLine = jest.fn();

  const exploreLogsTable = (
    <ExploreLogsTable
      data={panelData}
      width={100}
      timeZone={'UTC'}
      externalOptions={{
        frameIndex: 0,
      }}
      buildLinkToLogLine={buildLinkToLogLine}
      eventBus={new EventBusSrv()}
      panelState={undefined}
      height={100}
      onOptionsChange={function (options: Options): void {
        throw new Error('Function not implemented.');
      }}
      onFieldConfigChange={function (config: FieldConfigSource): void {
        throw new Error('Function not implemented.');
      }}
      onChangeTimeRange={function (range: AbsoluteTimeRange): void {
        throw new Error('Function not implemented.');
      }}
      onClickFilterLabel={undefined}
      onClickFilterOutLabel={undefined}
    />
  );
  it('should render', async () => {
    // @todo find out what is throwing this error
    jest.spyOn(console, 'error').mockImplementation();
    const { container } = render(exploreLogsTable);
    await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers).toHaveLength(2);
  });

  it.todo('should migrate columns to displayed fields');
});
