import { render, waitFor } from 'test/test-utils';
import { byLabelText, byTestId } from 'testing-library-selector';

import { setupMswServer } from '../../../mockApi';

import { StateToFilterValues } from './CentralAlertHistoryScene';
import { HistoryEventsList } from './EventListSceneObject';

setupMswServer();
// msw server is setup to intercept the history api call and return the mocked data by default
// that consists in 4 rows.
// 2 rows for alert1 and 2 rows for alert2

const ui = {
  rowHeader: byTestId('event-row-header'),
};
describe('HistoryEventsList', () => {
  it('should render the list correctly filtered by label in filter variable', async () => {
    render(<HistoryEventsList valueInLabelFilter={'alertname=alert1'} valueInStateToFilter={StateToFilterValues.all} valueInStateFromFilter addFilter={jest.fn()} />);
    await waitFor(() => {
      expect(byLabelText('Loading bar').query()).not.toBeInTheDocument();
    });
    expect(ui.rowHeader.getAll()).toHaveLength(2); // 2 events for alert1
    expect(ui.rowHeader.getAll()[0]).toHaveTextContent(
      'June 14 at 06:39:00alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
    expect(ui.rowHeader.getAll()[1]).toHaveTextContent(
      'June 14 at 06:38:30alert1alertnamealert1grafana_folderFOLDER Ahandler/alerting/*'
    );
  });
});
