import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { ExploreToAlertingModal } from './ExploreToAlertingModal';

jest.mock('app/features/alerting/unified/utils/rule-form', () => ({
  dataQueriesToGrafanaQueries: jest.fn(),
  getDefaultExpressions: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

const mockDataQueriesToGrafanaQueries = jest.requireMock(
  'app/features/alerting/unified/utils/rule-form'
).dataQueriesToGrafanaQueries;
const mockGetDefaultExpressions = jest.requireMock(
  'app/features/alerting/unified/utils/rule-form'
).getDefaultExpressions;

const mockLocationServicePush = jest.mocked(locationService.push);

const defaultQueries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } }];

const defaultGrafanaQueries = [
  {
    refId: 'A',
    datasourceUid: 'prometheus-uid',
    queryType: '',
    model: { refId: 'A', expr: 'up', datasource: { uid: 'prometheus-uid' } },
    relativeTimeRange: { from: 600, to: 0 },
  },
];

const defaultExpressions = [
  {
    refId: 'B',
    datasourceUid: '-100',
    queryType: '',
    model: { refId: 'B', type: 'reduce', datasource: { uid: '-100' } },
    relativeTimeRange: { from: 600, to: 0 },
  },
  {
    refId: 'C',
    datasourceUid: '-100',
    queryType: '',
    model: { refId: 'C', type: 'threshold', datasource: { uid: '-100' } },
    relativeTimeRange: { from: 600, to: 0 },
  },
];

describe('ExploreToAlertingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataQueriesToGrafanaQueries.mockResolvedValue(defaultGrafanaQueries);
    mockGetDefaultExpressions.mockReturnValue(defaultExpressions);
  });

  it('renders the modal with title', async () => {
    render(<ExploreToAlertingModal onDismiss={jest.fn()} queries={defaultQueries} />);
    expect(await screen.findByRole('dialog', { name: /create alert rule/i })).toBeInTheDocument();
  });

  it('shows navigation options when queries are convertible', async () => {
    render(<ExploreToAlertingModal onDismiss={jest.fn()} queries={defaultQueries} />);

    expect(await screen.findByRole('button', { name: /open in new tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^open$/i })).toBeInTheDocument();
  });

  it('shows "no queries" message when no valid queries provided', async () => {
    mockDataQueriesToGrafanaQueries.mockResolvedValue([]);

    render(<ExploreToAlertingModal onDismiss={jest.fn()} queries={[]} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no alerting-capable queries found/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /open in new tab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^open$/i })).not.toBeInTheDocument();
  });

  it('calls locationService.push when "Open" button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExploreToAlertingModal onDismiss={jest.fn()} queries={defaultQueries} />);

    const openButton = await screen.findByRole('button', { name: /^open$/i });
    await user.click(openButton);

    expect(mockLocationServicePush).toHaveBeenCalledWith(expect.stringContaining('/alerting/new'));
  });

  it('calls onDismiss when Cancel button is clicked', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup();

    render(<ExploreToAlertingModal onDismiss={onDismiss} queries={defaultQueries} />);

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
