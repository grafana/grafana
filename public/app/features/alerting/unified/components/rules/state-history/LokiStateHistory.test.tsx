import { HttpResponse, http } from 'msw';
import { Props } from 'react-virtualized-auto-sizer';
import { render, waitFor } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { DataFrameJSON } from '@grafana/data';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import LokiStateHistory from './LokiStateHistory';

const server = setupMswServer();

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});

// Mock useMeasure from LogTimelineViewer > TimelineChart > GraphNG > VizLayout
// so it always renders the chart
jest.mock('react-use', () => {
  const reactUse = jest.requireActual('react-use');
  return {
    ...reactUse,
    useMeasure: () => {
      const setRef = () => {};
      return [setRef, { height: 300, width: 500 }];
    },
  };
});

beforeEach(() => {
  server.use(
    http.get('/api/v1/rules/history', () =>
      HttpResponse.json<DataFrameJSON>({
        data: {
          values: [
            [1681739580000, 1681739580000, 1681739580000],
            [
              {
                previous: 'Normal',
                current: 'Pending',
                values: {
                  B: 0.010344684900897919,
                  C: 1,
                },
                labels: {
                  handler: '/api/prometheus/grafana/api/v1/rules',
                },
              },
              {
                previous: 'Normal',
                current: 'Pending',
                values: {
                  B: 0.010344684900897919,
                  C: 1,
                },
                dashboardUID: '',
                panelID: 0,
                labels: {
                  handler: '/api/live/ws',
                },
              },
              {
                previous: 'Normal',
                current: 'Pending',
                values: {
                  B: 0.010344684900897919,
                  C: 1,
                },
                labels: {
                  handler: '/api/folders/:uid/',
                },
              },
            ],
          ],
        },
      })
    )
  );
});

window.HTMLElement.prototype.scrollIntoView = jest.fn();

const ui = {
  loadingIndicator: byText('Loading...'),
  timestampViewer: byRole('list', { name: 'State history by timestamp' }),
  noRecords: byText('No state transitions have occurred in the last 30 days'),
  timelineChart: byTestId('uplot-main-div'),
};

describe('LokiStateHistory', () => {
  it('should render history records', async () => {
    render(<LokiStateHistory ruleUID="ABC123" />);

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    const timestampViewerElement = ui.timestampViewer.get();
    expect(timestampViewerElement).toBeInTheDocument();

    expect(timestampViewerElement).toHaveTextContent('/api/prometheus/grafana/api/v1/rules');
    expect(timestampViewerElement).toHaveTextContent('/api/live/ws');
    expect(timestampViewerElement).toHaveTextContent('/api/folders/:uid/');
  });

  it('should render timeline chart', async () => {
    render(<LokiStateHistory ruleUID="ABC123" />);

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    expect(ui.timelineChart.get()).toBeInTheDocument();
  });

  it('should render no entries message when no records are returned', async () => {
    server.use(
      http.get('/api/v1/rules/history', () =>
        HttpResponse.json<DataFrameJSON>({ data: { values: [] }, schema: { fields: [] } })
      )
    );

    render(<LokiStateHistory ruleUID="abcd" />);

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    expect(ui.noRecords.get()).toBeInTheDocument();
  });
});
