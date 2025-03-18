import { render, waitFor } from 'test/test-utils';
import { byLabelText, byTestId } from 'testing-library-selector';

import { getDefaultTimeRange } from '@grafana/data';

import { setupMswServer } from '../../../mockApi';

import { StateFilterValues } from './CentralAlertHistoryScene';
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
});
