// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { fireEvent, getByText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  IconName,
  MutableDataFrame,
  PluginExtensionLink,
  PluginExtensionPoints,
  PluginExtensionTypes,
} from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { DEFAULT_SPAN_FILTERS } from 'app/features/explore/state/constants';

import { TraceViewPluginExtensionContext } from '../types/trace';

import { TracePageHeader } from './TracePageHeader';
import { trace } from './mocks';

// Mock @grafana/runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
  reportInteraction: jest.fn(),
}));

// Mock useAppNotification
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: jest.fn(() => ({
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock config
jest.mock('../../../../../core/config', () => ({
  config: {
    feedbackLinksEnabled: false, // Default to false to avoid interference with tests
  },
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

// Helper function to create properly typed mock plugin extension links
const createMockExtension = (
  id: string,
  title: string,
  description = '',
  options: {
    icon?: string;
    path?: string;
    onClick?: () => void;
  } = {}
): PluginExtensionLink => ({
  id,
  type: PluginExtensionTypes.link,
  title,
  description,
  pluginId: 'test-plugin',
  icon: options.icon as IconName,
  path: options.path,
  onClick: options.onClick,
});

const setup = (pluginLinks: { links: PluginExtensionLink[]; isLoading: boolean } = { links: [], isLoading: false }) => {
  const mockUsePluginLinks = usePluginLinks as jest.MockedFunction<typeof usePluginLinks>;
  mockUsePluginLinks.mockReturnValue(pluginLinks);

  const defaultProps = {
    trace,
    timeZone: '',
    search: DEFAULT_SPAN_FILTERS,
    setSearch: jest.fn(),
    showSpanFilters: true,
    setShowSpanFilters: jest.fn(),
    showSpanFilterMatchesOnly: false,
    setShowSpanFilterMatchesOnly: jest.fn(),
    showCriticalPathSpansOnly: false,
    setShowCriticalPathSpansOnly: jest.fn(),
    spanFilterMatches: undefined,
    setFocusedSpanIdForSearch: jest.fn(),
    datasourceType: 'tempo',
    setHeaderHeight: jest.fn(),
    data: new MutableDataFrame(),
    datasourceName: 'test-datasource',
    datasourceUid: 'test-datasource-uid',
  };

  return {
    ...render(<TracePageHeader {...defaultProps} />),
    mockUsePluginLinks,
  };
};

describe('TracePageHeader test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  it('should render the new trace header', () => {
    setup();

    const header = document.querySelector('header');
    const method = getByText(header!, 'POST');
    const status = getByText(header!, '200');
    const url = getByText(header!, '/v2/gamma/792edh2w897y2huehd2h89');
    const duration = getByText(header!, '2.36s');
    const timestampElement = getByText(header!, '2023-02-05 08:50:56.289');
    expect(method).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(duration).toBeInTheDocument();
    expect(timestampElement).toBeInTheDocument();
  });

  describe('Plugin Extensions', () => {
    it('should call usePluginLinks with correct parameters including datasource context', () => {
      const { mockUsePluginLinks } = setup();

      expect(mockUsePluginLinks).toHaveBeenCalledWith({
        extensionPointId: PluginExtensionPoints.TraceViewHeaderActions,
        context: {
          ...trace,
          datasource: {
            name: 'test-datasource',
            uid: 'test-datasource-uid',
            type: 'tempo',
          },
        },
        limitPerPlugin: 2,
      });
    });

    it('should not render plugin extension buttons when no extensions are available', () => {
      setup({ links: [], isLoading: false });

      const extensionButtons = screen.queryByTestId('plugin-extension-button');
      expect(extensionButtons).not.toBeInTheDocument();
    });

    it('should render plugin extension buttons when extensions are available', () => {
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension 1', 'Test extension description', {
          icon: 'external-link-alt',
          path: 'https://example.com',
          onClick: jest.fn(),
        }),
        createMockExtension('test-extension-2', 'Test Extension 2', 'Another test extension', {
          icon: 'cloud',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      expect(screen.getByText('Test Extension 1')).toBeInTheDocument();
      expect(screen.getByText('Test Extension 2')).toBeInTheDocument();
    });

    it('should display tooltips for extension buttons', async () => {
      const user = userEvent.setup();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'This is a test extension description', {
          icon: 'external-link-alt',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Test Extension');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('This is a test extension description')).toBeInTheDocument();
      });
    });

    it('should use title as tooltip when description is not provided', async () => {
      const user = userEvent.setup();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension Title', 'Test Extension Title', {
          icon: 'external-link-alt',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByRole('button', { name: /Test Extension Title/i });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toHaveTextContent('Test Extension Title');
      });
    });

    it('should handle extension button clicks with onClick handler', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          icon: 'external-link-alt',
          onClick: mockOnClick,
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Test Extension');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle extension button clicks with path navigation', async () => {
      const user = userEvent.setup();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          icon: 'external-link-alt',
          path: 'https://example.com/trace-details',
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Test Extension');
      await user.click(button);

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/trace-details', '_blank');
    });

    it('should handle extension with both path and onClick', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          icon: 'external-link-alt',
          path: 'https://example.com/trace-details',
          onClick: mockOnClick,
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Test Extension');
      await user.click(button);

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/trace-details', '_blank');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should render extension buttons with correct styling', () => {
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          icon: 'external-link-alt',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByRole('button', { name: /Test Extension/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('css-7byezq-button'); // Grafana button primary class
    });

    it('should render extension icons when provided', () => {
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          icon: 'external-link-alt',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByRole('button', { name: /Test Extension/i });
      const iconElement = button.querySelector('svg');
      expect(iconElement).toBeInTheDocument();
    });

    it('should handle multiple extensions correctly', () => {
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Extension 1', 'First extension', {
          icon: 'external-link-alt',
          onClick: jest.fn(),
        }),
        createMockExtension('test-extension-2', 'Extension 2', 'Second extension', {
          icon: 'cloud',
          path: 'https://example.com',
        }),
        createMockExtension('test-extension-3', 'Extension 3', 'Third extension', {
          icon: 'apps',
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      expect(screen.getByText('Extension 1')).toBeInTheDocument();
      expect(screen.getByText('Extension 2')).toBeInTheDocument();
      expect(screen.getByText('Extension 3')).toBeInTheDocument();
    });

    it('should maintain extension context with trace data and datasource information', () => {
      const { mockUsePluginLinks } = setup();

      const [callArgs] = mockUsePluginLinks.mock.calls;
      expect(callArgs[0]).toEqual({
        extensionPointId: PluginExtensionPoints.TraceViewHeaderActions,
        context: {
          ...trace,
          datasource: {
            name: 'test-datasource',
            uid: 'test-datasource-uid',
            type: 'tempo',
          },
        },
        limitPerPlugin: 2,
      });

      // Verify the context contains the expected trace properties
      expect(callArgs[0].context).toHaveProperty('traceID', trace.traceID);
      expect(callArgs[0].context).toHaveProperty('spans');
      expect(callArgs[0].context).toHaveProperty('duration', trace.duration);
      expect(callArgs[0].context).toHaveProperty('startTime', trace.startTime);

      // Verify the context contains the datasource information
      expect(callArgs[0].context).toHaveProperty('datasource');
      const contextWithDatasource = callArgs[0].context as TraceViewPluginExtensionContext;
      expect(contextWithDatasource.datasource).toEqual({
        name: 'test-datasource',
        uid: 'test-datasource-uid',
        type: 'tempo',
      });
    });

    it('should handle loading state gracefully', () => {
      setup({ links: [], isLoading: true });

      // Should not crash when loading and should not show any extension buttons
      const extensionButtons = screen.queryByTestId('plugin-extension-button');
      expect(extensionButtons).not.toBeInTheDocument();
    });

    it('should handle extensions without icons', () => {
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Extension Without Icon', 'Extension without icon', {
          onClick: jest.fn(),
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Extension Without Icon');
      expect(button).toBeInTheDocument();
      // Should render the button even without an icon
    });

    it('should handle extension click without event parameter', async () => {
      const mockOnClick = jest.fn();
      const mockExtensions: PluginExtensionLink[] = [
        createMockExtension('test-extension-1', 'Test Extension', 'Test extension', {
          onClick: mockOnClick,
        }),
      ];

      setup({ links: mockExtensions, isLoading: false });

      const button = screen.getByText('Test Extension');

      // Simulate a click that might not pass event
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should provide datasource context to plugin extensions', () => {
      const { mockUsePluginLinks } = setup();

      const contextArg = mockUsePluginLinks.mock.calls[0][0].context as TraceViewPluginExtensionContext;

      // Verify that plugin extensions receive datasource information in context
      expect(contextArg.datasource).toBeDefined();
      expect(contextArg.datasource.name).toBe('test-datasource');
      expect(contextArg.datasource.uid).toBe('test-datasource-uid');
      expect(contextArg.datasource.type).toBe('tempo');

      // Verify that trace data is still available
      expect(contextArg.traceID).toBe(trace.traceID);
      expect(contextArg.spans).toBe(trace.spans);
    });
  });

  describe('Feedback Button', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should not render feedback button when feedbackLinksEnabled is false', () => {
      // config.feedbackLinksEnabled is already mocked to false
      setup();

      const feedbackButton = screen.queryByText('Feedback');
      expect(feedbackButton).not.toBeInTheDocument();
    });

    it('should render feedback button when feedbackLinksEnabled is true', () => {
      // Mock config with feedbackLinksEnabled = true
      const mockConfig = require('../../../../../core/config');
      mockConfig.config.feedbackLinksEnabled = true;

      setup();

      const feedbackButton = screen.getByText('Feedback');
      expect(feedbackButton).toBeInTheDocument();
      expect(feedbackButton.closest('a')).toHaveAttribute('href', 'https://forms.gle/RZDEx8ScyZNguDoC8');
      expect(feedbackButton.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('should display tooltip for feedback button', async () => {
      const user = userEvent.setup();

      // Mock config with feedbackLinksEnabled = true
      const mockConfig = require('../../../../../core/config');
      mockConfig.config.feedbackLinksEnabled = true;

      setup();

      const feedbackButton = screen.getByText('Feedback');
      await user.hover(feedbackButton);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Share your thoughts about tracing in Grafana.')).toBeInTheDocument();
      });
    });

    it('should render feedback button with correct styling and icon', () => {
      // Mock config with feedbackLinksEnabled = true
      const mockConfig = require('../../../../../core/config');
      mockConfig.config.feedbackLinksEnabled = true;

      setup();

      const feedbackButton = screen.getByText('Feedback');
      const buttonElement = feedbackButton.closest('a');

      expect(buttonElement).toBeInTheDocument();
      expect(buttonElement).toHaveClass('css-125ehy6-button'); // Secondary variant class

      // Check for icon
      const iconElement = buttonElement?.querySelector('svg');
      expect(iconElement).toBeInTheDocument();
    });
  });
});
