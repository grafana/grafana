import { render, waitFor } from 'test/test-utils';
import { byLabelText, byTestId } from 'testing-library-selector';

import { getDefaultTimeRange } from '@grafana/data';

import { setupMswServer } from '../../../mockApi';
import { captureRequests } from '../../../mocks/server/events';

import { StateFilterValues } from './CentralAlertHistoryScene';
import { getHistory } from './CentralHistoryRuntimeDataSource';
import { HistoryEventsList } from './EventListSceneObject';

setupMswServer();
// msw server is setup to intercept the history api call and return the mocked data by default
// that consists in 4 rows.
// 2 rows for alert1 and 2 rows for alert2

const ui = {
  rowHeader: byTestId('event-row-header'),
  loadingBar: byLabelText('Loading bar'),
};
describe('HistoryEventsList', () => {
  it('should render the full list correctly when no filters are applied', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={''}
        valueInStateToFilter={StateFilterValues.all}
        valueInStateFromFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(4);
  });
  it('should render the list correctly filtered by label in filter variable', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={'alertname=alert1'}
        valueInStateToFilter={StateFilterValues.all}
        valueInStateFromFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(2); // 2 events for alert1
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:39:00alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
    expect(ui.rowHeader.getAll()[1]).toHaveTextContent(
      'June 14 at 06:38:30alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
  });

  it('should render the list correctly filtered by from and to state ', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={''}
        valueInStateFromFilter={StateFilterValues.firing}
        valueInStateToFilter={StateFilterValues.normal}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(1);
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:38:30alert2alertnamealert2grafana_folderFOLDER Ahandler/alerting/*'
    );
  });

  it('should render the list correctly filtered by state to', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={''}
        valueInStateToFilter={StateFilterValues.firing}
        valueInStateFromFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(2);
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:39:00alert2alertnamealert2grafana_folderFOLDER Ahandler/alerting/*'
    );
    expect(ui.rowHeader.getAll()[1]).toHaveTextContent(
      'June 14 at 06:38:30alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
  });
  it('should render the list correctly filtered by state from', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={''}
        valueInStateFromFilter={StateFilterValues.firing}
        valueInStateToFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(1);
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:38:30alert2alertnamealert2grafana_folderFOLDER Ahandler/alerting/*'
    );
  });

  it('should render the list correctly filtered by label and state to', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={'alertname=alert1'}
        valueInStateToFilter={StateFilterValues.firing}
        valueInStateFromFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(1);
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:38:30alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
  });

  it('should handle an empty list when no events match the filter criteria', async () => {
    render(
      <HistoryEventsList
        valueInLabelFilter={'nonexistentlabel=xyz'}
        valueInStateToFilter={StateFilterValues.all}
        valueInStateFromFilter={StateFilterValues.all}
        addFilter={jest.fn()}
        timeRange={getDefaultTimeRange()}
      />
    );
    await waitFor(() => {
      expect(ui.loadingBar.query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.query()).not.toBeInTheDocument();
  });

  describe('backend filtering', () => {
    it('should send only exact match filters to the backend', async () => {
      const capture = captureRequests((req) => req.url.includes('/api/v1/rules/history'));

      render(
        <HistoryEventsList
          valueInLabelFilter={'alertname=alert1, grafana_folder=~".*folder.*", severity!=high, team="alerting"'}
          valueInStateToFilter={StateFilterValues.all}
          valueInStateFromFilter={StateFilterValues.all}
          addFilter={jest.fn()}
          timeRange={getDefaultTimeRange()}
        />
      );

      await waitFor(() => {
        expect(ui.loadingBar.query()).not.toBeInTheDocument();
      });

      const requests = await capture;
      expect(requests).toHaveLength(1);

      const url = new URL(requests[0].url);

      expect(url.searchParams.get('labels_alertname')).toBe('alert1');
      expect(url.searchParams.get('labels_team')).toBe('alerting');
      expect(url.searchParams.get('labels_grafana_folder')).toBeNull();
      expect(url.searchParams.get('labels_severity')).toBeNull();
    });

    it('should apply same backend filtering to chart data via getHistory function', async () => {
      const capture = captureRequests((req) => req.url.includes('/api/v1/rules/history'));

      const from = 123;
      const to = 456;
      const labels = { alertname: 'alert_1', team: 'alerting' };

      await getHistory(from, to, labels);

      const requests = await capture;
      expect(requests).toHaveLength(1);

      const url = new URL(requests[0].url);

      expect(url.searchParams.get('labels_alertname')).toBe(labels.alertname);
      expect(url.searchParams.get('labels_team')).toBe(labels.team);
      expect(url.searchParams.get('from')).toBe(from.toString());
      expect(url.searchParams.get('to')).toBe(to.toString());
    });
  });
});
