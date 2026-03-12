import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTransformationContent } from 'app/features/transformers/docs/getTransformationContent';

import { TransformationEditorHelpDisplay } from './TransformationEditorHelpDisplay';

jest.mock('app/features/transformers/docs/getTransformationContent', () => ({
  getTransformationContent: jest.fn(),
}));

const mockGetTransformationContent = jest.mocked(getTransformationContent);
const mockOnCloseClick = jest.fn();

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
  beforeEach(() => {
    jest.clearAllMocks();
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
    await waitFor(() => {}); // flush pending async content fetch
  });

  it('fetches help content when opened', async () => {
    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    expect(mockGetTransformationContent).toHaveBeenCalledWith('test-transform');

    await waitFor(() => {
      expect(screen.getByText('Test help content')).toBeInTheDocument();
    });
  });

  it('shows fallback content when fetch fails', async () => {
    mockGetTransformationContent.mockRejectedValue(new Error('Network error'));

    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    await waitFor(() => {
      expect(screen.getByText('transformation documentation')).toBeInTheDocument();
    });
  });

  it('calls onCloseClick with false when the drawer is dismissed', async () => {
    render(
      <TransformationEditorHelpDisplay isOpen={true} onCloseClick={mockOnCloseClick} transformer={mockTransformer} />
    );

    fireEvent.click(screen.getByTestId('data-testid Drawer close'));

    expect(mockOnCloseClick).toHaveBeenCalledWith(false);
    await waitFor(() => {}); // flush pending async content fetch
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
