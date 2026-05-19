import { fireEvent, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  isAdvisorEnabled,
  useCreateDatasourceAdvisorChecks,
  useLatestDatasourceCheck,
} from 'app/features/connections/hooks/useDatasourceAdvisorChecks';

import { RunAdvisorChecksButton } from './RunAdvisorChecksButton';

jest.mock('app/features/connections/hooks/useDatasourceAdvisorChecks', () => ({
  isAdvisorEnabled: jest.fn(),
  useCreateDatasourceAdvisorChecks: jest.fn(),
  useLatestDatasourceCheck: jest.fn(),
}));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: jest.fn(),
}));

const mockIsAdvisorEnabled = isAdvisorEnabled as jest.Mock;
const mockUseCreateDatasourceAdvisorChecks = useCreateDatasourceAdvisorChecks as jest.Mock;
const mockUseLatestDatasourceCheck = useLatestDatasourceCheck as jest.Mock;
const mockReportInteraction = reportInteraction as jest.Mock;
const mockUseAppNotification = useAppNotification as jest.Mock;
const mockNotifySuccess = jest.fn();

describe('RunAdvisorChecksButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppNotification.mockReturnValue({
      success: mockNotifySuccess,
      warning: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    });
    mockIsAdvisorEnabled.mockReturnValue(true);
    mockUseCreateDatasourceAdvisorChecks.mockReturnValue({
      createChecks: jest.fn(),
      isCreatingChecks: false,
      isAvailable: true,
    });
    mockUseLatestDatasourceCheck.mockReturnValue({ check: undefined, isLoading: false });
  });

  it('does not render when advisor is disabled', () => {
    mockIsAdvisorEnabled.mockReturnValue(false);

    const { container } = render(<RunAdvisorChecksButton />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when advisor create checks function is unavailable', () => {
    mockUseCreateDatasourceAdvisorChecks.mockReturnValue({
      createChecks: jest.fn(),
      isCreatingChecks: false,
      isAvailable: false,
    });

    const { container } = render(<RunAdvisorChecksButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when a previous check already exists', () => {
    mockUseLatestDatasourceCheck.mockReturnValue({
      check: { metadata: { name: 'check-1' } },
      isLoading: false,
    });

    const { container } = render(<RunAdvisorChecksButton />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render while latest check is loading', () => {
    mockUseLatestDatasourceCheck.mockReturnValue({
      check: undefined,
      isLoading: true,
    });

    const { container } = render(<RunAdvisorChecksButton />);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps rendering while checks are running even if latest check is loading', () => {
    mockUseCreateDatasourceAdvisorChecks.mockReturnValue({
      createChecks: jest.fn(),
      isCreatingChecks: true,
      isAvailable: true,
    });
    mockUseLatestDatasourceCheck.mockReturnValue({
      check: { metadata: { name: 'check-1' } },
      isLoading: true,
    });

    render(<RunAdvisorChecksButton />);

    expect(screen.getByRole('button', { name: 'Running checks' })).toBeInTheDocument();
  });

  it('runs checks when clicked', () => {
    const createChecks = jest.fn();
    mockUseCreateDatasourceAdvisorChecks.mockReturnValue({ createChecks, isCreatingChecks: false, isAvailable: true });

    render(<RunAdvisorChecksButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable Advisor checks' }));

    expect(createChecks).toHaveBeenCalledTimes(1);
    expect(mockReportInteraction).toHaveBeenCalledWith('connections_datasource_list_advisor_run_checks_clicked', {
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
  });

  it('disables the button while checks are running', () => {
    mockUseCreateDatasourceAdvisorChecks.mockReturnValue({
      createChecks: jest.fn(),
      isCreatingChecks: true,
      isAvailable: true,
    });

    render(<RunAdvisorChecksButton />);

    const button = screen.getByRole('button', { name: 'Running checks' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Enable Advisor checks' })).not.toBeInTheDocument();
  });

  it('shows success notification when checks complete after user click', () => {
    const createChecks = jest.fn();
    let isCreatingChecks = false;
    let check: { metadata: { name: string } } | undefined;

    mockUseCreateDatasourceAdvisorChecks.mockImplementation(() => ({
      createChecks,
      isCreatingChecks,
      isAvailable: true,
    }));
    mockUseLatestDatasourceCheck.mockImplementation(() => ({
      check,
      isLoading: false,
    }));

    const { rerender } = render(<RunAdvisorChecksButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable Advisor checks' }));

    isCreatingChecks = true;
    rerender(<RunAdvisorChecksButton />);

    isCreatingChecks = false;
    check = { metadata: { name: 'check-1' } };
    rerender(<RunAdvisorChecksButton />);

    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'Advisor checks created successfully. Go to Administration > Advisor for more details.'
    );
    expect(mockNotifySuccess).toHaveBeenCalledTimes(1);
  });
});
