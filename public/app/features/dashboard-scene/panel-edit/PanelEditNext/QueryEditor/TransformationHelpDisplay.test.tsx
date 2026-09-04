import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { TransformationHelpDisplay } from './TransformationHelpDisplay';
import * as QueryEditorContext from './QueryEditorContext';
import { mockTransformToggles, renderWithQueryEditorProvider } from './testUtils';
import type { Transformation } from './types';

jest.mock('app/features/transformers/docs/getTransformationContent', () => ({
  getTransformationContent: jest.fn(),
}));

const mockGetTransformationContent = jest.mocked(getTransformationContent);

const mockTransformationInfo: DataTransformerInfo = {
  id: 'test-transform',
  name: 'Test Transform',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: () => Promise.resolve(mockTransformationInfo),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

function makeTransformation(registryItem?: TransformerRegistryItem): Transformation {
  return {
    transformId: 'test-transform',
    transformConfig: { id: 'test-transform', options: {} },
    registryItem: registryItem ?? mockRegistryItem,
  };
}

describe('TransformationHelpDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTransformationContent.mockResolvedValue({
      name: 'Test Transform',
      helperDocs: 'Test help content',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not render when showHelp is false', () => {
    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: false },
      },
    });

    expect(screen.queryByText('Transformation help')).not.toBeInTheDocument();
    expect(mockGetTransformationContent).not.toHaveBeenCalled();
  });

  it('does not render when showHelp is true but no transformation is selected', () => {
    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: null,
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true },
      },
    });

    expect(screen.queryByText('Transformation help')).not.toBeInTheDocument();
    expect(mockGetTransformationContent).not.toHaveBeenCalled();
  });

  it('renders the drawer with the correct title and subtitle when showHelp is true', async () => {
    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true },
      },
    });

    expect(screen.getByText('Test Transform')).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Drawer.General.subtitle)).toBeInTheDocument();
    await screen.findByText('Test help content');
  });

  it('fetches and renders help content when the drawer opens', async () => {
    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true },
      },
    });

    expect(mockGetTransformationContent).toHaveBeenCalledWith('test-transform');
    await screen.findByText('Test help content');
  });

  it('does not show help from the previous transformation while new help loads', async () => {
    const nextRegistryItem = {
      ...mockRegistryItem,
      id: 'next-transform',
      name: 'Next Transform',
    };
    let resolveNextHelp!: (content: { name: string; helperDocs: string }) => void;

    mockGetTransformationContent.mockImplementation(id => {
      if (id === mockRegistryItem.id) {
        return Promise.resolve({ name: mockRegistryItem.name, helperDocs: 'Previous help content' });
      }

      return new Promise(resolve => {
        resolveNextHelp = resolve;
      });
    });

    const context = {
      selectedTransformation: makeTransformation(),
      transformToggles: { ...mockTransformToggles, showHelp: true },
    } as ReturnType<typeof QueryEditorContext.useQueryEditorUIContext>;
    const contextSpy = jest.spyOn(QueryEditorContext, 'useQueryEditorUIContext').mockReturnValue(context);
    const { rerender } = render(<TransformationHelpDisplay />);

    await screen.findByText('Previous help content');

    context.selectedTransformation = makeTransformation(nextRegistryItem);
    rerender(<TransformationHelpDisplay />);

    expect(screen.queryByText('Previous help content')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /transformation documentation/i })).toBeInTheDocument();

    resolveNextHelp({ name: nextRegistryItem.name, helperDocs: 'Next help content' });
    await screen.findByText('Next help content');
  });

  it('shows fallback content when fetch fails', async () => {
    mockGetTransformationContent.mockRejectedValue(new Error('Network error'));

    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /transformation documentation/i })).toBeInTheDocument();
    });
  });

  it('calls toggleHelp when the drawer is dismissed', async () => {
    const toggleHelp = jest.fn();

    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true, toggleHelp },
      },
    });

    await userEvent.click(screen.getByTestId(selectors.components.Drawer.General.close));

    expect(toggleHelp).toHaveBeenCalled();
  });
});
