import { screen } from '@testing-library/react';

import { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';

import { TransformationEditorRenderer } from './TransformationEditorRenderer';
import { renderWithQueryEditorProvider } from './testUtils';
import { Transformation } from './types';

// Prevent the real hook from running subscriptions against transformDataFrame.
jest.mock('./hooks/useTransformationInputData', () => ({
  useTransformationInputData: jest.fn(() => []),
}));

jest.mock('./TransformationFilterDisplay', () => ({
  TransformationFilterDisplay: () => <div data-testid="transformation-filter-display" />,
}));

jest.mock('./TransformationEditor', () => ({
  TransformationEditor: () => <div data-testid="transformation-editor" />,
}));

jest.mock('./TransformationHelpDisplay', () => ({
  TransformationHelpDisplay: () => <div data-testid="transformation-help-display" />,
}));

jest.mock('./TransformationDebugDisplay', () => ({
  TransformationDebugDisplay: () => <div data-testid="transformation-debug-display" />,
}));

const mockTransformation: DataTransformerInfo = {
  id: 'test-transform',
  name: 'Test Transform',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: mockTransformation,
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

describe('TransformationEditorRenderer', () => {
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
