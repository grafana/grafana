import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { usePluginComponent } from '@grafana/runtime';

import { useLatestDatasourceCheck } from '../../hooks/useDatasourceAdvisorChecks';

import { AdvisorGenerateReportButton } from './AdvisorGenerateReportButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

jest.mock('../../hooks/useDatasourceAdvisorChecks', () => ({
  useLatestDatasourceCheck: jest.fn(),
}));

type GenerateReportButtonProps = {
  label?: string;
  loadingLabel?: string;
  autoRegister?: boolean;
  onClick?: () => void;
};

const usePluginComponentMock = jest.mocked(usePluginComponent);
const useLatestDatasourceCheckMock = jest.mocked(useLatestDatasourceCheck);

function makeCheckWithReportCount(count: number): Check {
  return {
    apiVersion: 'advisor.grafana.app/v0alpha1',
    kind: 'Check',
    metadata: {
      name: 'check-1',
      labels: { 'advisor.grafana.app/type': 'datasource' },
    },
    spec: {},
    status: {
      report: {
        count,
        failures: [],
      },
    },
  };
}

describe('AdvisorGenerateReportButton', () => {
  beforeEach(() => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: false,
    } as ReturnType<typeof usePluginComponent<GenerateReportButtonProps>>);

    useLatestDatasourceCheckMock.mockReturnValue({
      check: undefined,
      isLoading: false,
      refetchLatestCheck: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not render while extension component is loading', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: true,
    } as ReturnType<typeof usePluginComponent<GenerateReportButtonProps>>);

    render(<AdvisorGenerateReportButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render when extension component is unavailable', () => {
    render(<AdvisorGenerateReportButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders extension button when there are no checks yet', () => {
    const ExposedButton: ComponentType<GenerateReportButtonProps> = ({ label }) => (
      <button>{label ?? 'Generate report'}</button>
    );

    usePluginComponentMock.mockReturnValue({
      component: ExposedButton,
      isLoading: false,
    } as ReturnType<typeof usePluginComponent<GenerateReportButtonProps>>);

    render(<AdvisorGenerateReportButton />);
    expect(screen.getByRole('button', { name: /run advisor checks/i })).toBeInTheDocument();
  });

  it('does not render when at least one check result already exists', () => {
    const ExposedButton: ComponentType<GenerateReportButtonProps> = ({ label }) => (
      <button>{label ?? 'Generate report'}</button>
    );
    usePluginComponentMock.mockReturnValue({
      component: ExposedButton,
      isLoading: false,
    } as ReturnType<typeof usePluginComponent<GenerateReportButtonProps>>);

    useLatestDatasourceCheckMock.mockReturnValue({
      check: makeCheckWithReportCount(1),
      isLoading: false,
      refetchLatestCheck: jest.fn(),
    });

    render(<AdvisorGenerateReportButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls refetch when exposed button onClick is triggered', () => {
    jest.useFakeTimers();
    const ExposedButton: ComponentType<GenerateReportButtonProps> = ({ label, onClick }) => (
      <button onClick={onClick}>{label ?? 'Generate report'}</button>
    );
    const refetchLatestCheck = jest.fn();

    usePluginComponentMock.mockReturnValue({
      component: ExposedButton,
      isLoading: false,
    } as ReturnType<typeof usePluginComponent<GenerateReportButtonProps>>);

    useLatestDatasourceCheckMock.mockReturnValue({
      check: undefined,
      isLoading: false,
      refetchLatestCheck,
    } as ReturnType<typeof useLatestDatasourceCheck>);

    render(<AdvisorGenerateReportButton />);
    fireEvent.click(screen.getByRole('button', { name: /run advisor checks/i }));
    jest.advanceTimersByTime(1000);
    expect(refetchLatestCheck).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
