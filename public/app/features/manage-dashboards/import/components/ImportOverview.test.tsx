import { render, screen } from '@testing-library/react';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { DashboardSource } from '../../types';

import { ImportOverview } from './ImportOverview';

const mockIsDashboardV2Spec = jest.mocked(isDashboardV2Spec);

jest.mock('app/features/dashboard/api/utils', () => ({
  ...jest.requireActual('app/features/dashboard/api/utils'),
  isDashboardV2Spec: jest.fn(),
}));

jest.mock('./ImportOverviewV1', () => ({
  ImportOverviewV1: () => <div data-testid="import-overview-v1">V1 Overview</div>,
}));

jest.mock('./ImportOverviewV2', () => ({
  ImportOverviewV2: () => <div data-testid="import-overview-v2">V2 Overview</div>,
}));

const defaultProps = {
  inputs: {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  },
  meta: { updatedAt: '', orgName: '' },
  source: DashboardSource.Json,
  onCancel: jest.fn(),
};

describe('ImportOverview', () => {
  it('renders V1 overview for empty dashboard object', () => {
    mockIsDashboardV2Spec.mockReturnValue(false);
    render(<ImportOverview {...defaultProps} dashboard={{}} />);
    expect(screen.getByTestId('import-overview-v1')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v2')).not.toBeInTheDocument();
  });

  it('renders V2 overview for dashboard with elements', () => {
    mockIsDashboardV2Spec.mockReturnValue(true);
    render(<ImportOverview {...defaultProps} dashboard={{ title: 'Test', elements: {} }} />);
    expect(screen.getByTestId('import-overview-v2')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v1')).not.toBeInTheDocument();
  });
});
