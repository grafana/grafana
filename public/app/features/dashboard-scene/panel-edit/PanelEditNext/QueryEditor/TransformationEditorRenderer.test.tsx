import { render, screen } from '@testing-library/react';

import { type DataTransformerInfo, type TransformerRegistryItem } from '@grafana/data';

import { TransformationEditorPanel, TransformationEditorRenderer } from './TransformationEditorRenderer';
import { renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

// Prevent the real hook from running subscriptions against transformDataFrame.
jest.mock('./hooks/useTransformationInputData', () => ({
  useTransformationInputData: jest.fn(() => []),
}));

jest.mock('./TransformationFilterDisplay', () => ({
  // Mirrors the live failure: the display hands `filter.options` to `RefIDMultiPicker`, which reads
  // it as a string, so a dashboard supplying anything else throws from render.
  TransformationFilterEditor: ({ transformation }: { transformation: Transformation | null }) => {
    const filterOptions = transformation?.transformConfig.filter?.options;

    if (filterOptions != null && typeof filterOptions !== 'string') {
      throw new Error('value.startsWith is not a function');
    }

    return <div data-testid="transformation-filter-display" />;
  },
}));

jest.mock('./TransformationEditor', () => ({
  TransformationEditor: () => <div data-testid="transformation-editor" />,
}));

jest.mock('./TransformationHelpDisplay', () => ({
  TransformationHelpDisplay: () => <div data-testid="transformation-help-display" />,
}));

let debugDisplayThrows = false;

jest.mock('./TransformationDebugDisplay', () => ({
  TransformationDebugDisplay: () => {
    if (debugDisplayThrows) {
      throw new Error('the debug drawer could not describe this transformation');
    }
    return <div data-testid="transformation-debug-display" />;
  },
}));

const mockTransformation: DataTransformerInfo = {
  id: 'test-transform',
  name: 'Test Transform',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: () => Promise.resolve(mockTransformation),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

function makeTransformation(registryItem: TransformerRegistryItem | undefined): Transformation {
  return {
    transformId: 'test-transform',
    transformConfig: { id: 'test-transform', options: {} },
    registryItem,
  };
}

/** A transformation carrying the filter a dashboard supplied, as its own config object. */
function withFilter(transformation: Transformation, options: unknown): Transformation {
  return {
    ...transformation,
    transformConfig: { ...transformation.transformConfig, filter: { id: 'byRefId', options } },
  };
}

function panel(transformation: Transformation) {
  return (
    <TransformationEditorPanel
      transformation={transformation}
      transformations={[transformation]}
      updateTransformation={jest.fn()}
      showSupplementalDisplays
    />
  );
}

describe('TransformationEditorRenderer', () => {
  afterEach(() => {
    debugDisplayThrows = false;
  });

  it('lets a supplemental display recover when another transformation is selected', () => {
    // `ErrorBoundary` clears its error only when one of its dependencies changes. Without one, a
    // display that threw stays on the alert for the rest of its life — and nothing here unmounts it,
    // so the user cannot get it back by reselecting or by closing the drawer.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugDisplayThrows = true;

    const { rerender } = render(panel(makeTransformation(mockRegistryItem)));

    expect(screen.queryByTestId('transformation-debug-display')).not.toBeInTheDocument();

    debugDisplayThrows = false;
    rerender(panel({ ...makeTransformation(mockRegistryItem), transformId: 'another-transform' }));

    expect(screen.getByTestId('transformation-debug-display')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('clears a display that threw once the failing transformation is edited', () => {
    // `transformId` is the transformation's id and its index, so it does not move when the options
    // change — and editing them is how an option-induced throw gets fixed. Recovering on the config
    // too is what keeps the alert from outliving the config that caused it.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const broken = withFilter(makeTransformation(mockRegistryItem), 42);
    const { rerender } = render(panel(broken));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-filter-display')).not.toBeInTheDocument();

    // What removing the filter does: a fresh config object under the same id at the same index.
    const { filter, ...withoutFilter } = broken.transformConfig;
    rerender(panel({ ...broken, transformConfig: withoutFilter }));

    expect(screen.getByTestId('transformation-filter-display')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('clears a display that threw when a transformation of the same type takes its index', () => {
    // Deleting a transformation slides its successor into its index, which for a successor of the
    // same type reproduces the id exactly. The alert would otherwise stand over a transformation
    // that never threw, hiding the filter it could have edited.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const throwing = withFilter(makeTransformation(mockRegistryItem), 42);
    const successor = withFilter(makeTransformation(mockRegistryItem), '/^(?:A)$/');
    // The premise: without colliding ids the boundary would recover for the wrong reason.
    expect(successor.transformId).toBe(throwing.transformId);

    const { rerender } = render(panel(throwing));

    expect(screen.queryByTestId('transformation-filter-display')).not.toBeInTheDocument();

    rerender(panel(successor));

    expect(screen.getByTestId('transformation-filter-display')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('keeps the editor up when a supplemental display cannot render', () => {
    // All three displays replay the pipeline to describe it, over frames and options a dashboard
    // supplies. Bounding them separately is what keeps a throw in one from taking the editor — the
    // part the user is actually working in — down with it.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugDisplayThrows = true;

    renderWithQueryEditorProvider(<TransformationEditorRenderer />, {
      selectedTransformation: makeTransformation(mockRegistryItem),
    });

    expect(screen.getByTestId('transformation-editor')).toBeInTheDocument();
    expect(screen.getByTestId('transformation-filter-display')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-debug-display')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('renders nothing when no transformation is selected', () => {
    // The renderer is mounted regardless of selection state, so it must guard against
    // rendering the editor when nothing is selected (e.g. on initial load or after deselection).
    const { container } = renderWithQueryEditorProvider(<TransformationEditorRenderer />, {
      selectedTransformation: null,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders an error alert when the selected transformation has no registry item', () => {
    // A transformation can exist in the config without a matching registry entry if a plugin
    // is missing or unloaded. The renderer must degrade gracefully rather than crash.
    renderWithQueryEditorProvider(<TransformationEditorRenderer />, {
      selectedTransformation: makeTransformation(undefined),
    });

    expect(screen.getByText(/transformation does not have an editor component/i)).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-editor')).not.toBeInTheDocument();
  });

  it('renders the full editor suite when a transformation with a valid editor is selected', () => {
    renderWithQueryEditorProvider(<TransformationEditorRenderer />, {
      selectedTransformation: makeTransformation(mockRegistryItem),
    });

    // All four sections — filter, editor, help, debug — should be present. If any is missing
    // the user loses capability (can't configure, inspect, or debug the transformation).
    expect(screen.getByTestId('transformation-filter-display')).toBeInTheDocument();
    expect(screen.getByTestId('transformation-editor')).toBeInTheDocument();
    expect(screen.getByTestId('transformation-help-display')).toBeInTheDocument();
    expect(screen.getByTestId('transformation-debug-display')).toBeInTheDocument();
  });
});
