/* eslint-disable testing-library/render-result-naming-convention */
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type Key } from 'react';
import { type RenderRowProps } from 'react-data-grid';

import { type DataHoverEvent, type EventBus, type Field, FieldType } from '@grafana/data';

import { type PanelContext } from '../../PanelChrome';

import { renderRowFactory } from './rowBuilder';
import { type TableRow, type TableSummaryRow } from './types';

jest.mock('react-data-grid', () => ({
  Row: ({ onMouseEnter, onMouseLeave, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="rdg-row" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...rest} />
  ),
}));

function makeEventBus(): jest.Mocked<EventBus> {
  return {
    publish: jest.fn(),
    getStream: jest.fn(),
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  };
}

function makePanelContext(eventBus: EventBus): PanelContext {
  return {
    eventsScope: 'test',
    eventBus,
    onSeriesColorChange: jest.fn(),
    onToggleSeriesVisibility: jest.fn(),
    canAddAnnotations: jest.fn(),
    canEditAnnotations: jest.fn(),
    canDeleteAnnotations: jest.fn(),
    onAnnotationCreate: jest.fn(),
    onAnnotationUpdate: jest.fn(),
    onAnnotationDelete: jest.fn(),
    onSelectRange: jest.fn(),
    onAddAdHocFilter: jest.fn(),
    instanceState: {},
    onInstanceStateChange: jest.fn(),
    onToggleLegendSort: jest.fn(),
    onUpdateData: jest.fn(),
  };
}

function makeTimeField(values: number[] = [1000, 2000, 3000]): Field {
  return { name: 'time', type: FieldType.time, values, config: {}, state: {} };
}

function makeStringField(): Field {
  return { name: 'value', type: FieldType.string, values: ['a', 'b', 'c'], config: {}, state: {} };
}

function makeRowProps(row: TableRow): RenderRowProps<TableRow, TableSummaryRow> {
  return { row } as unknown as RenderRowProps<TableRow, TableSummaryRow>;
}

function renderNode(key: Key, factory: ReturnType<typeof renderRowFactory>, row: TableRow) {
  const node = factory(key, makeRowProps(row));
  if (node === null) {
    return null;
  }
  return render(<>{node}</>);
}

describe('renderRowFactory', () => {
  const getStableKey = (idx: number) => `row-${idx}`;

  describe('nested child rows (__depth === 1)', () => {
    it('returns null when the parent row is not expanded', () => {
      const eventBus = makeEventBus();
      const factory = renderRowFactory([], makePanelContext(eventBus), new Set(), false, getStableKey);
      const row: TableRow = { __depth: 1, __index: 2 };

      const result = renderNode('k', factory, row);

      expect(result).toBeNull();
    });

    it('renders Row with aria-level and aria-expanded when parent is expanded', () => {
      const eventBus = makeEventBus();
      const expandedRows = new Set([getStableKey(2)]);
      const factory = renderRowFactory([], makePanelContext(eventBus), expandedRows, false, getStableKey);
      const row: TableRow = { __depth: 1, __index: 2 };

      renderNode('k', factory, row);

      const rowEl = screen.getByTestId('rdg-row');
      expect(rowEl).toBeInTheDocument();
      expect(rowEl).toHaveAttribute('aria-level', String(row.__index + 1));
      expect(rowEl).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('top-level rows (__depth !== 1)', () => {
    it('renders a Row without mouse handlers when enableSharedCrosshair is false', () => {
      const eventBus = makeEventBus();
      const factory = renderRowFactory([makeTimeField()], makePanelContext(eventBus), new Set(), false, getStableKey);

      renderNode('k', factory, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      expect(rowEl).toBeInTheDocument();

      rowEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('renders a Row without mouse handlers when there is no time field', () => {
      const eventBus = makeEventBus();
      const factory = renderRowFactory([makeStringField()], makePanelContext(eventBus), new Set(), true, getStableKey);

      renderNode('k', factory, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      rowEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes DataHoverEvent on mouse enter when enableSharedCrosshair is true and time field exists', async () => {
      const eventBus = makeEventBus();
      const timeValues = [1000, 2000, 3000];
      const factory = renderRowFactory(
        [makeTimeField(timeValues)],
        makePanelContext(eventBus),
        new Set(),
        true,
        getStableKey
      );

      renderNode('k', factory, { __depth: 0, __index: 1 });

      await userEvent.hover(screen.getByTestId('rdg-row'));

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-hover',
          payload: { point: { time: timeValues[1] } },
        })
      );
    });

    it('publishes DataHoverClearEvent on mouse leave', async () => {
      const eventBus = makeEventBus();
      const factory = renderRowFactory([makeTimeField()], makePanelContext(eventBus), new Set(), true, getStableKey);

      renderNode('k', factory, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      await userEvent.hover(rowEl);
      await userEvent.unhover(rowEl);

      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'data-hover-clear' }));
    });

    it('uses rowIdx from the row to look up the correct time value', async () => {
      const eventBus = makeEventBus();
      const timeValues = [100, 200, 300];
      const factory = renderRowFactory(
        [makeTimeField(timeValues)],
        makePanelContext(eventBus),
        new Set(),
        true,
        getStableKey
      );

      renderNode('k', factory, { __depth: 0, __index: 2 });

      await userEvent.hover(screen.getByTestId('rdg-row'));

      const call = (eventBus.publish as jest.Mock).mock.calls[0][0] as DataHoverEvent;
      expect(call.payload.point.time).toBe(timeValues[2]);
    });
  });
});
