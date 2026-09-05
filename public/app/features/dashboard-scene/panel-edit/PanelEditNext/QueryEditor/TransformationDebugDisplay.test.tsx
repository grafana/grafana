import { screen } from '@testing-library/react';

import { type TransformerRegistryItem } from '@grafana/data';

import { TransformationDebugDisplay } from './TransformationDebugDisplay';
import { renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

jest.mock('./hooks/useTransformationDebugData', () => ({
  useTransformationDebugData: jest.fn(() => ({ input: [], output: [] })),
}));

const mockRegistryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: () => Promise.resolve({ id: 'test-transform', name: 'Test Transform', operator: jest.fn() }),
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

describe('TransformationDebugDisplay', () => {
  it('renders nothing when debug is not active', () => {
    const { container } = renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
      selectedTransformation: makeTransformation(mockRegistryItem),
      uiStateOverrides: {
        transformToggles: { showDebug: false, toggleDebug: jest.fn(), showHelp: false, toggleHelp: jest.fn() },
      },
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no transformation is selected', () => {
    const { container } = renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
      selectedTransformation: null,
      uiStateOverrides: {
        transformToggles: { showDebug: true, toggleDebug: jest.fn(), showHelp: false, toggleHelp: jest.fn() },
      },
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders input and output sections with copy buttons when debug is active', () => {
    renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
      selectedTransformation: makeTransformation(mockRegistryItem),
      uiStateOverrides: {
        transformToggles: { showDebug: true, toggleDebug: jest.fn(), showHelp: false, toggleHelp: jest.fn() },
      },
    });

    expect(screen.getByText('Input data')).toBeInTheDocument();
    expect(screen.getByText('Output data')).toBeInTheDocument();

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons).toHaveLength(2);
  });
});
