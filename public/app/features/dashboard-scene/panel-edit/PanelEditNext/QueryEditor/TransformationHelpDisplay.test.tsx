import { screen, waitFor, fireEvent } from '@testing-library/react';

import { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { TransformationHelpDisplay } from './TransformationHelpDisplay';
import { mockTransformToggles, renderWithQueryEditorProvider } from './testUtils';
import { Transformation } from './types';

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
  transformation: mockTransformationInfo,
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
    await waitFor(() => {}); // flush pending async content fetch
  });

  it('fetches and renders help content when the drawer opens', async () => {
    renderWithQueryEditorProvider(<TransformationHelpDisplay />, {
      selectedTransformation: makeTransformation(),
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showHelp: true },
      },
    });

    expect(mockGetTransformationContent).toHaveBeenCalledWith('test-transform');

    await waitFor(() => {
      expect(screen.getByText('Test help content')).toBeInTheDocument();
    });
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
      expect(screen.getByText('transformation documentation')).toBeInTheDocument();
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

    fireEvent.click(screen.getByTestId('data-testid Drawer close'));

    expect(toggleHelp).toHaveBeenCalled();
    await waitFor(() => {}); // flush pending async content fetch
  });
});
