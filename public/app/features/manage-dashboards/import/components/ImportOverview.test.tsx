import { render, screen } from '@testing-library/react';

import { DashboardInputs, DashboardSource } from '../../types';

import { ImportOverview } from './ImportOverview';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getSearchObject: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('./ImportOverviewV1', () => ({
  ImportOverviewV1: () => <div data-testid="import-overview-v1">V1 Overview</div>,
}));

jest.mock('./ImportOverviewV2', () => ({
  ImportOverviewV2: () => <div data-testid="import-overview-v2">V2 Overview</div>,
}));

const emptyInputs: DashboardInputs = {
  dataSources: [],
  constants: [],
  libraryPanels: [],
};

const defaultProps = {
  inputs: emptyInputs,
  meta: { updatedAt: '', orgName: '' },
  source: DashboardSource.Json,
  onCancel: jest.fn(),
};

describe('ImportOverview', () => {
  it('renders V1 overview for empty dashboard object', () => {
    render(<ImportOverview {...defaultProps} dashboard={{}} />);
    expect(screen.getByTestId('import-overview-v1')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v2')).not.toBeInTheDocument();
  });

  it('renders V1 overview for V1 dashboard with title', () => {
    render(<ImportOverview {...defaultProps} dashboard={{ title: 'Test Dashboard', uid: 'test-uid' }} />);
    expect(screen.getByTestId('import-overview-v1')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v2')).not.toBeInTheDocument();
  });

  it('renders V1 overview for dashboard with only panels', () => {
    render(<ImportOverview {...defaultProps} dashboard={{ panels: [] }} />);
    expect(screen.getByTestId('import-overview-v1')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v2')).not.toBeInTheDocument();
  });

  it('renders V2 overview for dashboard with elements', () => {
    render(<ImportOverview {...defaultProps} dashboard={{ title: 'Test', elements: {} }} />);
    expect(screen.getByTestId('import-overview-v2')).toBeInTheDocument();
    expect(screen.queryByTestId('import-overview-v1')).not.toBeInTheDocument();
  });
});
