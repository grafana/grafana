import { screen } from '@testing-library/react';

import { type DataTransformerInfo, FrameMatcherID, getDefaultTimeRange, LoadingState, type TransformerRegistryItem } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { DataTopic } from '@grafana/schema';

import { mockTransformToggles, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { TransformationActionButtons } from './TransformationActionButtons';

const mockTransformerInfo: DataTransformerInfo = {
  id: 'test-transform',
  name: 'Test Transform',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: mockTransformerInfo,
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

function makeTransformation(overrides: Partial<Transformation> = {}): Transformation {
  return {
    transformId: 'test-transform',
    transformConfig: { id: 'test-transform', options: {} },
    registryItem: mockRegistryItem,
    ...overrides,
  };
}

function makeSeries(): DataFrame[] {
  return [{ fields: [], length: 0, refId: 'A' }];
}

function makeData(overrides: Partial<{ series: DataFrame[]; annotations: DataFrame[] }> = {}) {
  return {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
    ...overrides,
  };
}

describe('TransformationActionButtons', () => {
  it('renders nothing when no transformation is selected', () => {
    const { container } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
      selectedTransformation: null,
    });

    expect(container).toBeEmptyDOMElement();
  });

  describe('help and debug actions', () => {
    it('shows transformation help button when help metadata exists and toggles help', async () => {
      const toggleHelp = jest.fn();
      const transformation = makeTransformation({
        registryItem: { ...mockRegistryItem, help: 'https://example.test/help' } as TransformerRegistryItem,
      });

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        uiStateOverrides: {
          transformToggles: { ...mockTransformToggles, showHelp: false, toggleHelp },
        },
      });

      await user.click(screen.getByRole('button', { name: /show transformation help/i }));

      expect(toggleHelp).toHaveBeenCalledTimes(1);
    });

    it('uses "Hide transformation help" label when help is expanded', () => {
      const transformation = makeTransformation({
        registryItem: { ...mockRegistryItem, help: 'https://example.test/help' } as TransformerRegistryItem,
      });

      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        uiStateOverrides: {
          transformToggles: { ...mockTransformToggles, showHelp: true },
        },
      });

      expect(screen.getByRole('button', { name: /hide transformation help/i })).toBeInTheDocument();
    });

    it('always renders debug button and toggles debug mode', async () => {
      const toggleDebug = jest.fn();

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
        uiStateOverrides: {
          transformToggles: { ...mockTransformToggles, showDebug: false, toggleDebug },
        },
      });

      await user.click(screen.getByRole('button', { name: /debug/i }));

      expect(toggleDebug).toHaveBeenCalledTimes(1);
    });
  });

  describe('filter button visibility', () => {
    it('hides the filter button when there is no data and no filter configured', () => {
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
        qrState: { data: makeData() },
      });

      expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    });

    it('shows the filter button when there are data series', () => {
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
        qrState: { data: makeData({ series: makeSeries() }) },
      });

      expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument();
    });

    it('shows the filter button when there are annotations', () => {
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
        qrState: { data: makeData({ annotations: [{ fields: [], length: 0 }] }) },
      });

      expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument();
    });

    it('shows the filter button when a filter is already configured, even with no data', () => {
      // The filter button must remain visible when a filter is active so the user
      // can remove it — regardless of whether data is currently present.
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation({
          transformConfig: {
            id: 'test-transform',
            options: {},
            filter: { id: FrameMatcherID.byRefId, options: 'A' },
          },
        }),
        qrState: { data: makeData() },
      });

      expect(screen.getByRole('button', { name: /remove filter/i })).toBeInTheDocument();
    });

    it('shows the filter button when a topic is configured, even with no data', () => {
      // topic keeps the button visible (and active), but since no explicit filter is set
      // the label says "Add filter" — clicking will add a filter, not remove the topic.
      // This mirrors v1 (TransformationOperationRow) where toggleFilter only touches `filter`.
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation({
          transformConfig: {
            id: 'test-transform',
            options: {},
            topic: DataTopic.Annotations,
          },
        }),
        qrState: { data: makeData() },
      });

      expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument();
    });
  });

  describe('filter button toggle behaviour', () => {
    it('adds a filter when clicking with no filter configured', async () => {
      const updateTransformation = jest.fn();
      const transformation = makeTransformation();

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        qrState: { data: makeData({ series: makeSeries() }) },
        actionsOverrides: { updateTransformation },
      });

      await user.click(screen.getByRole('button', { name: /add filter/i }));

      expect(updateTransformation).toHaveBeenCalledWith(transformation.transformConfig, {
        ...transformation.transformConfig,
        filter: { id: FrameMatcherID.byRefId, options: '' },
      });
    });

    it('removes only the filter when a filter is configured', async () => {
      const updateTransformation = jest.fn();
      const config = {
        id: 'test-transform',
        options: {},
        filter: { id: FrameMatcherID.byRefId, options: 'A' },
      };
      const transformation = makeTransformation({ transformConfig: config });

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        qrState: { data: makeData() },
        actionsOverrides: { updateTransformation },
      });

      await user.click(screen.getByRole('button', { name: /remove filter/i }));

      expect(updateTransformation).toHaveBeenCalledWith(config, { id: 'test-transform', options: {} });
    });

    it('adds a filter without removing topic when only topic is configured', async () => {
      // Mirrors v1: toggleFilter only ever adds/removes `filter`; `topic` is untouched.
      const updateTransformation = jest.fn();
      const config = {
        id: 'test-transform',
        options: {},
        topic: DataTopic.Annotations,
      };
      const transformation = makeTransformation({ transformConfig: config });

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        qrState: { data: makeData() },
        actionsOverrides: { updateTransformation },
      });

      await user.click(screen.getByRole('button', { name: /add filter/i }));

      expect(updateTransformation).toHaveBeenCalledWith(config, {
        ...config,
        filter: { id: FrameMatcherID.byRefId, options: '' },
      });
    });

    it('removes filter but leaves topic intact when both are configured', async () => {
      const updateTransformation = jest.fn();
      const config = {
        id: 'test-transform',
        options: {},
        filter: { id: FrameMatcherID.byRefId, options: 'A' },
        topic: DataTopic.Annotations,
      };
      const transformation = makeTransformation({ transformConfig: config });

      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: transformation,
        qrState: { data: makeData() },
        actionsOverrides: { updateTransformation },
      });

      await user.click(screen.getByRole('button', { name: /remove filter/i }));

      expect(updateTransformation).toHaveBeenCalledWith(config, {
        id: 'test-transform',
        options: {},
        topic: DataTopic.Annotations,
      });
    });
  });

  describe('debug button behaviour', () => {
    it('always shows the debug action for a selected transformation', () => {
      renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
      });

      expect(screen.getByRole('button', { name: /debug/i })).toBeInTheDocument();
    });

    it('toggles debug mode when clicked', async () => {
      const toggleDebug = jest.fn();
      const { user } = renderWithQueryEditorProvider(<TransformationActionButtons />, {
        selectedTransformation: makeTransformation(),
        uiStateOverrides: {
          transformToggles: {
            showHelp: false,
            toggleHelp: jest.fn(),
            showDebug: false,
            toggleDebug,
          },
        },
      });

      await user.click(screen.getByRole('button', { name: /debug/i }));

      expect(toggleDebug).toHaveBeenCalledTimes(1);
    });
  });
});
