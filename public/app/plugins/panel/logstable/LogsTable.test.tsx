import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {
  type AbsoluteTimeRange,
  CoreApp,
  type EventBus,
  EventBusSrv,
  type FieldConfigSource,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  type ScopedVars,
} from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { defaultTableOptions } from '@grafana/schema';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { LOG_LINE_BODY_FIELD_NAME } from '../../../features/logs/components/fieldSelector/logFields';

import { LogsTable } from './LogsTable';
import { type Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';
import { getPanelData } from './testsUtils';

jest.mock('@openfeature/react-sdk', () => ({
  useBooleanFlagValue: jest.fn().mockReturnValue(false),
}));

const fieldConfig: FieldConfigSource = {
  defaults: {},
  overrides: [],
};

const mockEventBus: EventBus = {
  publish: jest.fn(),
  getStream: jest.fn(),
  subscribe: jest.fn(),
  removeAllListeners: jest.fn(),
  newScopedBus: jest.fn(),
};

// Mock TableNG to disable virtualization, otherwise the lack of viewport in our testing env will cause the table to only render a single column
jest.mock('@grafana/ui/unstable', () => {
  const actual = jest.requireActual('@grafana/ui/unstable');
  const MockTableNG = actual.TableNG;
  return {
    ...actual,
    TableNG: (props: React.ComponentProps<typeof MockTableNG>) => (
      <MockTableNG {...props} enableVirtualization={false} />
    ),
  };
});

const publishMockFn = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: publishMockFn,
  })),
  getDataSourceSrv: jest.fn(() => ({
    get: () => Promise.resolve(null),
  })),
  usePluginLinks: jest.fn().mockReturnValue({
    links: [],
    isLoading: false,
  }),
}));

const setUp = (
  props?: Partial<React.ComponentProps<typeof LogsTable>>,
  options?: Partial<Options>,
  app = CoreApp.Dashboard,
  panelContext?: Partial<PanelContext>
) => {
  return render(
    <PanelContextProvider
      value={{
        app,
        eventsScope: 'test',
        eventBus: new EventBusSrv(),
        ...panelContext,
      }}
    >
      <LogsTable
        data={getPanelData()}
        id={0}
        timeZone={'UTC'}
        options={{
          ...defaultOptions,
          ...defaultTableOptions,
          showHeader: true,
          frameIndex: 0,
          ...options,
        }}
        transparent={false}
        width={800}
        height={600}
        fieldConfig={fieldConfig}
        renderCounter={0}
        title={''}
        eventBus={mockEventBus}
        onOptionsChange={function (options: Options): void {
          throw new Error('Function not implemented.');
        }}
        onFieldConfigChange={function (config: FieldConfigSource): void {
          throw new Error('Function not implemented.');
        }}
        replaceVariables={function (value: string, scopedVars?: ScopedVars, format?: string | Function): string {
          throw new Error('Function not implemented.');
        }}
        onChangeTimeRange={function (timeRange: AbsoluteTimeRange): void {
          throw new Error('Function not implemented.');
        }}
        {...props}
      />
    </PanelContextProvider>
  );
};

describe('LogsTable', () => {
  let origResizeObserver = global.ResizeObserver;
  let origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  let jestScrollIntoView = jest.fn();

  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer, extractFieldsTransformer]);
  });

  beforeEach(() => {
    jestScrollIntoView = jest.fn();
    origResizeObserver = global.ResizeObserver;
    origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      callback: unknown;
      constructor(callback: unknown) {
        this.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    window.HTMLElement.prototype.scrollIntoView = jestScrollIntoView;
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
    window.HTMLElement.prototype.scrollIntoView = origScrollIntoView;
  });

  it('should render', async () => {
    const { container } = setUp();
    await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
    expect(container.querySelector('[role="gridcell"]')).toBeVisible();

    // Table headers (time, level from labels, body by default)
    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers).toHaveLength(3);
    expect(headers[0].textContent).toEqual('timestamp');
    expect(headers[1].textContent).toEqual('level');
    expect(headers[2].textContent).toEqual('body');
  });

  describe('Panel controls', () => {
    it('should display', async () => {
      setUp(undefined, { showControls: true });
      await waitFor(() => expect(screen.getByLabelText('Expand')).toBeInTheDocument());

      // Expand the options
      await userEvent.click(screen.getByLabelText('Expand'));
      expect(screen.queryByLabelText('Expanded')).toBeInTheDocument();
      expect(screen.queryByLabelText('Newest logs first')).toBeInTheDocument();
    });

    it('should publish app event', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp({ onOptionsChange }, { showControls: true });
      await waitFor(() => expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument());

      // Expand the options
      expect(publishMockFn).toHaveBeenCalledTimes(0);
      await userEvent.click(screen.getByLabelText(/Sorted by new/i));
      expect(publishMockFn).toHaveBeenCalledTimes(1);
      expect(publishMockFn).toHaveBeenCalledWith(
        new LogSortOrderChangeEvent({
          order: LogsSortOrder.Ascending,
        })
      );
    });
  });

  describe('Wrap text', () => {
    it('not in Dashboards, with logs controls enabled, when wrap text is set via options only, toggling calls onOptionsChange but not onFieldConfigChange', async () => {
      const onOptionsChange = jest.fn();
      const onFieldConfigChange = jest.fn();
      setUp({ onOptionsChange, onFieldConfigChange }, { showControls: true, wrapText: false }, CoreApp.Explore);
      await waitFor(() => expect(screen.getByLabelText('Enable text wrapping')).toBeInTheDocument());
      expect(onOptionsChange).not.toHaveBeenCalled();
      expect(onFieldConfigChange).not.toHaveBeenCalled();

      await userEvent.click(screen.getByLabelText('Enable text wrapping'));

      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith(expect.objectContaining({ wrapText: true }));
      expect(onFieldConfigChange).not.toHaveBeenCalled();
    });

    it('in Dashboards, when wrap text is set via field config, toggling calls onFieldConfigChange but not onOptionsChange', async () => {
      const onOptionsChange = jest.fn();
      const onFieldConfigChange = jest.fn();
      const fieldConfigWithWrapText: FieldConfigSource = {
        defaults: { custom: { wrapText: false } },
        overrides: [],
      };
      setUp({ onOptionsChange, onFieldConfigChange, fieldConfig: fieldConfigWithWrapText }, { showControls: true });
      await waitFor(() => expect(screen.getByLabelText('Enable text wrapping')).toBeInTheDocument());
      expect(onOptionsChange).not.toHaveBeenCalled();
      expect(onFieldConfigChange).not.toHaveBeenCalled();

      await userEvent.click(screen.getByLabelText('Enable text wrapping'));

      expect(onOptionsChange).not.toHaveBeenCalled();
      expect(onFieldConfigChange).toHaveBeenCalledTimes(1);
      expect(onFieldConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({
            custom: expect.objectContaining({ wrapText: true }),
          }),
        })
      );
    });
  });

  describe('fieldSelector', () => {
    it('should add to displayed fields', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp({ onOptionsChange });
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      // Level is shown by default; `service` is extracted from labels and starts unchecked
      expect(screen.getByRole('checkbox', { name: /service/i })).not.toBeChecked();
      expect(onOptionsChange).toBeCalledTimes(0);

      await userEvent.click(screen.getByRole('checkbox', { name: /service/i }));
      expect(onOptionsChange).toBeCalledTimes(1);
      expect(onOptionsChange).toBeCalledWith(
        expect.objectContaining({
          displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, 'level', LOG_LINE_BODY_FIELD_NAME, 'service'],
        })
      );
    });

    it('should remove from displayed fields', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp(
        { onOptionsChange },
        { displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME, 'level'] }
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: /level/i })).toBeChecked();
      expect(onOptionsChange).toBeCalledTimes(0);

      await userEvent.click(screen.getByRole('checkbox', { name: /level/i }));
      expect(onOptionsChange).toBeCalledTimes(1);
      expect(onOptionsChange).toBeCalledWith(
        expect.objectContaining({ displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOG_LINE_BODY_FIELD_NAME] })
      );
    });

    it('should reset to default displayed fields', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp(
        { onOptionsChange },
        { displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOG_LINE_BODY_FIELD_NAME, 'level'] }
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: /level/i })).toBeChecked();
      expect(onOptionsChange).toBeCalledTimes(0);

      await userEvent.click(screen.getByText('Reset'));
      expect(onOptionsChange).toBeCalledTimes(1);
      expect(onOptionsChange).toBeCalledWith(
        expect.objectContaining({
          displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, 'level', LOG_LINE_BODY_FIELD_NAME],
        })
      );
    });
  });

  describe('custom cell renderer', () => {
    it('when level is the second column, renders exactly one custom cell per data row', async () => {
      const onOptionsChange = jest.fn();
      const { container } = setUp(
        { onOptionsChange },
        {
          showInspectLogLine: true,
        }
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());

      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers).toHaveLength(3);
      expect(headers[0].textContent).toEqual('timestamp');
      expect(headers[1].textContent).toEqual('level');

      // Two log rows; show details exists only in the custom timestamp column (one per row).
      expect(screen.getAllByLabelText('Show details')).toHaveLength(2);
    });

    it('when level is the first column, renders exactly one custom cell per data row', async () => {
      const onOptionsChange = jest.fn();
      const { container } = setUp(
        { onOptionsChange },
        {
          showInspectLogLine: true,
          displayedFields: ['level', LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME],
        }
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());

      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers).toHaveLength(3);
      expect(headers[0].textContent).toEqual('level');
      expect(headers[1].textContent).toEqual('timestamp');

      expect(screen.getAllByLabelText('Show details')).toHaveLength(2);
    });
  });

  describe('Log details', () => {
    it('opens the log details view when "Show details" is clicked', async () => {
      setUp(undefined, { showInspectLogLine: true });
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());

      expect(screen.queryByLabelText('Close log details sidebar')).not.toBeInTheDocument();

      await userEvent.click(screen.getAllByLabelText('Show details')[0]);

      await waitFor(() => {
        expect(screen.getByLabelText('Close log details sidebar')).toBeInTheDocument();
      });
    });

    it('calls onAddAdHocFilter when using filter-for from log details', async () => {
      const onAddAdHocFilter = jest.fn();
      setUp(undefined, { showInspectLogLine: true }, CoreApp.Dashboard, { onAddAdHocFilter });
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());

      await userEvent.click(screen.getAllByLabelText('Show details')[0]);

      await userEvent.click(screen.getAllByLabelText('Filter for value')[0]);

      expect(onAddAdHocFilter).toHaveBeenCalledTimes(1);
      expect(onAddAdHocFilter).toHaveBeenCalledWith({
        key: 'level',
        value: 'info',
        operator: '=',
      });

      await userEvent.click(screen.getAllByLabelText('Filter out value')[0]);

      expect(onAddAdHocFilter).toHaveBeenCalledTimes(2);
      expect(onAddAdHocFilter).toHaveBeenCalledWith({
        key: 'level',
        value: 'info',
        operator: '!=',
      });
    });
  });
});
