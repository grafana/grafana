import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TransformerRegistryItem } from '@grafana/data/transformations';
import type { DataTransformerInfo } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { TransformationEditorHelpDisplay } from './TransformationEditorHelpDisplay';

jest.mock('app/features/transformers/docs/getTransformationContent', () => ({
  getTransformationContent: jest.fn(),
}));

const mockGetTransformationContent = jest.mocked(getTransformationContent);

const mockTransformationInfo: DataTransformerInfo = {
  id: 'test-transform',
  name: 'Test Transform',
  operator: jest.fn(),
};

const mockTransformer: TransformerRegistryItem<null> = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: mockTransformationInfo,
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

describe('TransformationEditorHelpDisplay', () => {
  let mockOnCloseClick: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnCloseClick = jest.fn();
    mockGetTransformationContent.mockResolvedValue({
      name: 'Test Transform',
      helperDocs: 'Test help content',
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <TransformationEditorHelpDisplay isOpen={false} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    expect(screen.queryByText('Transformation help')).not.toBeInTheDocument();
    expect(mockGetTransformationContent).not.toHaveBeenCalled();
  });

  it('renders the drawer with the correct title and subtitle when open', async () => {
    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    expect(screen.getByText('Test Transform')).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Drawer.General.subtitle)).toBeInTheDocument();
    await screen.findByText('Test help content');
  });

  it('fetches help content when opened', async () => {
    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    expect(mockGetTransformationContent).toHaveBeenCalledWith('test-transform');
    await screen.findByText('Test help content');
  });

  it('shows fallback content when fetch fails', async () => {
    mockGetTransformationContent.mockRejectedValue(new Error('Network error'));

    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /transformation documentation/i })).toBeInTheDocument();
    });
  });

  it('calls onCloseClick with false when the drawer is dismissed', async () => {
    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    await userEvent.click(screen.getByTestId(selectors.components.Drawer.General.close));

    expect(mockOnCloseClick).toHaveBeenCalledWith(false);
  });

  it('does not apply stale content when transformer changes before fetch resolves', async () => {
    let resolveFirstFetch: (value: { name: string; helperDocs: string }) => void;
    const firstFetch = new Promise<{ name: string; helperDocs: string }>((res) => {
      resolveFirstFetch = res;
    });

    mockGetTransformationContent
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValueOnce({ name: 'Second', helperDocs: 'Content for second transformer' });

    const secondTransformer: TransformerRegistryItem<null> = {
      ...mockTransformer,
      id: 'second-transform',
      name: 'Second Transform',
      transformation: { ...mockTransformationInfo, id: 'second-transform', name: 'Second Transform' },
    };

    const { rerender } = render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    rerender(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={secondTransformer} />
    );

    await waitFor(() => {
      expect(screen.getByText('Content for second transformer')).toBeInTheDocument();
    });

    // Resolve the first (now-cancelled) fetch after the second has already settled
    resolveFirstFetch!({ name: 'First', helperDocs: 'Stale content from first transformer' });

    await waitFor(() => {
      expect(screen.queryByText('Stale content from first transformer')).not.toBeInTheDocument();
    });
  });
});
