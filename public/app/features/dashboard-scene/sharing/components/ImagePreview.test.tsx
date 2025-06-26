import { render, screen, cleanup } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { ImagePreview } from './ImagePreview';

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

beforeAll(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
  cleanup();
});

describe('ImagePreview', () => {
  const defaultProps = {
    imageBlob: null,
    isLoading: false,
    error: null,
  };

  it('should render empty container when no image, loading, or error', () => {
    render(<ImagePreview {...defaultProps} />);
    expect(screen.getByTestId(selectors.components.ExportImage.preview.container)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.loading)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.image)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.error.container)).not.toBeInTheDocument();
  });

  it('should show loading state with title when loading', () => {
    render(<ImagePreview {...defaultProps} isLoading={true} title="Test Title" />);
    expect(screen.getByTestId(selectors.components.ExportImage.preview.loading)).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should show error state when error is present', () => {
    const error = {
      title: 'Error Title',
      message: 'Error Message',
    };
    render(<ImagePreview {...defaultProps} error={error} />);
    expect(screen.getByTestId(selectors.components.ExportImage.preview.error.container)).toBeInTheDocument();
    expect(screen.getByText('Error Title')).toBeInTheDocument(); // Title is now in the Alert component
    expect(screen.getByTestId(selectors.components.ExportImage.preview.error.message)).toHaveTextContent(
      'Error Message'
    );
  });

  it('should show image when imageBlob is present', () => {
    const imageBlob = new Blob(['test'], { type: 'image/png' });
    mockCreateObjectURL.mockReturnValue('mock-url');
    render(<ImagePreview {...defaultProps} imageBlob={imageBlob} />);
    const image = screen.getByTestId(selectors.components.ExportImage.preview.image);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'Preview');
    expect(image).toHaveAttribute('aria-label', 'Generated image preview');
    expect(image).toHaveAttribute('src', 'mock-url');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(imageBlob);
  });

  it('should revoke object URL on unmount', () => {
    const imageBlob = new Blob(['test'], { type: 'image/png' });
    mockCreateObjectURL.mockReturnValue('mock-url');
    const { unmount } = render(<ImagePreview {...defaultProps} imageBlob={imageBlob} />);
    unmount();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
  });

  it('should not show image when loading', () => {
    const imageBlob = new Blob(['test'], { type: 'image/png' });
    render(<ImagePreview {...defaultProps} imageBlob={imageBlob} isLoading={true} />);
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.image)).not.toBeInTheDocument();
  });

  it('should not show error when loading', () => {
    const error = {
      title: 'Error Title',
      message: 'Error Message',
    };
    render(<ImagePreview {...defaultProps} error={error} isLoading={true} />);
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.error.container)).not.toBeInTheDocument();
  });

  it('should not show duplicate message when error title and message are the same', () => {
    const error = {
      title: 'Failed to generate image',
      message: 'Failed to generate image',
    };
    render(<ImagePreview {...defaultProps} error={error} />);
    expect(screen.getByTestId(selectors.components.ExportImage.preview.error.container)).toBeInTheDocument();
    expect(screen.getByText('Failed to generate image')).toBeInTheDocument(); // Title is shown in Alert
    expect(screen.queryByTestId(selectors.components.ExportImage.preview.error.message)).not.toBeInTheDocument(); // Message should not be shown separately
  });
});
