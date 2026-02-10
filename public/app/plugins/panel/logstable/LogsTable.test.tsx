import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {
  AbsoluteTimeRange,
  EventBus,
  FieldConfigSource,
  getDefaultTimeRange,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  ScopedVars,
} from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { defaultTableOptions } from '@grafana/schema/dist/esm/common/common.gen';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { LogsTable } from './LogsTable';
import { Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';
import { getPanelData } from './testsUtils';

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
}));

const setUp = (props?: Partial<React.ComponentProps<typeof LogsTable>>, options?: Partial<Options>) => {
  return render(
    <LogsTable
      data={getPanelData()}
      id={0}
      timeRange={getDefaultTimeRange()}
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

    // Table headers
    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toEqual('timestamp');
    expect(headers[1].textContent).toEqual('body');
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

  describe('fieldSelector', () => {
    it('should add to displayed fields', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp({ onOptionsChange });
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: /level/i })).not.toBeChecked();
      expect(onOptionsChange).toBeCalledTimes(0);

      await userEvent.click(screen.getByRole('checkbox', { name: /level/i }));
      expect(onOptionsChange).toBeCalledTimes(1);
      expect(onOptionsChange).toBeCalledWith(
        expect.objectContaining({ displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME, 'level'] })
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
        expect.objectContaining({ displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME] })
      );
    });

    it('should reset to default displayed fields', async () => {
      const onOptionsChange = jest.fn().mockImplementation((options: Options) => {});
      setUp(
        { onOptionsChange },
        { displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME, 'level'] }
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: /level/i })).toBeChecked();
      expect(onOptionsChange).toBeCalledTimes(0);

      await userEvent.click(screen.getByText('Reset'));
      expect(onOptionsChange).toBeCalledTimes(1);
      expect(onOptionsChange).toBeCalledWith(
        expect.objectContaining({ displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME] })
      );
    });
  });
});
