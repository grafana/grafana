import { screen } from '@testing-library/react';

import {
  DataFrame,
  DataTransformerInfo,
  FrameMatcherID,
  getDefaultTimeRange,
  LoadingState,
  TransformerRegistryItem,
} from '@grafana/data';
import { DataTopic } from '@grafana/schema';

import { renderWithQueryEditorProvider } from '../testUtils';
import { Transformation } from '../types';

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
});
