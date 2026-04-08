import { render, screen, fireEvent } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';

import { getMockDataSource } from '../mocks/dataSourcesMocks';
import { trackBuildDashboardDropdownClicked, trackCreateDashboardClicked, trackDsConfigClicked } from '../tracking';

import { BuildDashboardButton } from './BuildDashboardButton';
import { type SuggestedDashboardsLoaderChildProps } from './SuggestedDashboardsLoader';

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/interactions', () => ({
  DashboardLibraryInteractions: {
    entryPointClicked: jest.fn(),
  },
}));

jest.mock('../tracking', () => ({
  trackBuildDashboardDropdownClicked: jest.fn(),
  trackDsConfigClicked: jest.fn(),
  trackCreateDashboardClicked: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.mock('app/types/store', () => ({
  useDispatch: () => mockDispatch,
}));

jest.mock('app/core/reducers/appNotification', () => ({
  notifyApp: jest.fn((notification) => ({ type: 'notifyApp', payload: notification })),
}));

jest.mock('app/core/copy/appNotification', () => ({
  createWarningNotification: jest.fn((message) => ({ severity: 'warning', text: message })),
}));

const mockOpenModal = jest.fn();
const mockTriggerFetch = jest.fn();
let mockLoaderChildProps: SuggestedDashboardsLoaderChildProps = {
  fetchStatus: 'done',
  hasDashboards: true,
  triggerFetch: mockTriggerFetch,
  openModal: mockOpenModal,
};

let capturedOnFetchComplete: ((hasDashboards: boolean) => void) | undefined;

jest.mock('./SuggestedDashboardsLoader', () => ({
  SuggestedDashboardsLoader: ({
    children,
    onFetchComplete,
  }: {
    children: (props: SuggestedDashboardsLoaderChildProps) => ReactNode;
    onFetchComplete?: (hasDashboards: boolean) => void;
  }) => {
    capturedOnFetchComplete = onFetchComplete;
    return children(mockLoaderChildProps);
  },
}));

const dataSource = getMockDataSource({ uid: 'test-uid', typeName: 'TestDS' });

const defaultProps = {
  dataSource,
  size: 'md' as const,
  fill: 'solid' as const,
  context: 'datasource_page' as const,
};

describe('BuildDashboardButton', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
    capturedOnFetchComplete = undefined;
  });

  describe('feature flag off', () => {
    beforeEach(() => {
      config.featureToggles.suggestedDashboards = false;
    });

    it('should render a LinkButton with correct href', () => {
      render(
        <MemoryRouter>
          <BuildDashboardButton {...defaultProps} />
        </MemoryRouter>
      );

      const link = screen.getByRole('link', { name: /Build a dashboard/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'dashboard/new-with-ds/test-uid');
    });

    it('should not render the dropdown menu items', () => {
      render(
        <MemoryRouter>
          <BuildDashboardButton {...defaultProps} />
        </MemoryRouter>
      );

      expect(screen.queryByText('From suggestions')).not.toBeInTheDocument();
      expect(screen.queryByText('Blank')).not.toBeInTheDocument();
    });

    it('should fire tracking on click', () => {
      render(
        <MemoryRouter>
          <BuildDashboardButton {...defaultProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('link', { name: /Build a dashboard/i }));

      expect(trackDsConfigClicked).toHaveBeenCalledWith('build_a_dashboard');
      expect(trackCreateDashboardClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          datasource_uid: 'test-uid',
          plugin_name: 'TestDS',
        })
      );
    });
  });

  describe('feature flag on', () => {
    beforeEach(() => {
      config.featureToggles.suggestedDashboards = true;
      mockLoaderChildProps = {
        fetchStatus: 'done',
        hasDashboards: true,
        triggerFetch: mockTriggerFetch,
        openModal: mockOpenModal,
      };
    });

    afterEach(() => {
      config.featureToggles.suggestedDashboards = false;
    });

    it('should render a dropdown button with "Build a dashboard" text', () => {
      render(<BuildDashboardButton {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Build a dashboard/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Build a dashboard/i })).not.toBeInTheDocument();
    });

    it('should call triggerFetch and fire tracking when dropdown is opened', () => {
      render(<BuildDashboardButton {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));

      expect(mockTriggerFetch).toHaveBeenCalled();
      expect(trackBuildDashboardDropdownClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          datasource_uid: 'test-uid',
          plugin_name: 'TestDS',
        })
      );
    });

    it('should show "From suggestions" as disabled while loading', () => {
      mockLoaderChildProps = {
        fetchStatus: 'loading',
        hasDashboards: false,
        triggerFetch: mockTriggerFetch,
        openModal: mockOpenModal,
      };

      render(<BuildDashboardButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));

      const item = screen.getByRole('menuitem', { name: 'From suggestions' });
      expect(item).toBeDisabled();
    });

    it('should show "From suggestions" as disabled when no dashboards found', () => {
      mockLoaderChildProps = {
        fetchStatus: 'done',
        hasDashboards: false,
        triggerFetch: mockTriggerFetch,
        openModal: mockOpenModal,
      };

      render(<BuildDashboardButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));

      const item = screen.getByRole('menuitem', { name: 'From suggestions' });
      expect(item).toBeDisabled();
    });

    it('should fire entryPointClicked and open modal when clicking "From suggestions" (datasource_page)', () => {
      render(<BuildDashboardButton {...defaultProps} context="datasource_page" />);
      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'From suggestions' }));

      expect(DashboardLibraryInteractions.entryPointClicked).toHaveBeenCalledWith({
        entryPoint: 'datasource_page_build_button',
        contentKind: 'suggested_dashboards',
      });
      expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    it('should use correct entry point for datasource_list context', () => {
      render(<BuildDashboardButton {...defaultProps} context="datasource_list" />);
      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'From suggestions' }));

      expect(DashboardLibraryInteractions.entryPointClicked).toHaveBeenCalledWith({
        entryPoint: 'datasource_list_build_button',
        contentKind: 'suggested_dashboards',
      });
    });

    it('should fire tracking when clicking "Blank" menu item', () => {
      render(<BuildDashboardButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Build a dashboard/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Blank' }));

      expect(trackDsConfigClicked).toHaveBeenCalledWith('build_a_dashboard');
      expect(trackCreateDashboardClicked).toHaveBeenCalledWith(
        expect.objectContaining({
          datasource_uid: 'test-uid',
          plugin_name: 'TestDS',
        })
      );
    });

    it('should dispatch warning notification when onFetchComplete reports no dashboards', () => {
      render(<BuildDashboardButton {...defaultProps} />);

      expect(capturedOnFetchComplete).toBeDefined();
      capturedOnFetchComplete?.(false);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});
