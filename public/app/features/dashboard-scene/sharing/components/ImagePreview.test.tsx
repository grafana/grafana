import { render, screen, cleanup } from '@testing-library/react';

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
    // Container should exist with proper role and label
    expect(screen.getByRole('region', { name: 'Image preview' })).toBeInTheDocument();
    // Loading bar should not be visible
    expect(screen.queryByLabelText('Loading bar')).not.toBeInTheDocument();
    // Image should not be visible
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Error alert should not be visible
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show loading state with title when loading', () => {
    render(<ImagePreview {...defaultProps} isLoading={true} title="Test Title" />);
    // Loading state should be announced properly
    expect(screen.getByRole('status', { name: 'Generating image...' })).toBeInTheDocument();
    expect(screen.getByLabelText('Loading bar')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should show error state when error is present', () => {
    const error = {
      title: 'Error Title',
      message: 'Error Message',
    };
    render(<ImagePreview {...defaultProps} error={error} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error Message')).toBeInTheDocument();
  });

  it('should show image when imageBlob is present', () => {
    const imageBlob = new Blob(['test'], { type: 'image/png' });
    mockCreateObjectURL.mockReturnValue('mock-url');
    render(<ImagePreview {...defaultProps} imageBlob={imageBlob} />);
    const image = screen.getByRole('img', { name: 'Generated image preview' });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', 'Preview');
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
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Should show loading state instead
    expect(screen.getByRole('status', { name: 'Generating image...' })).toBeInTheDocument();
  });

  it('should not show error when loading', () => {
    const error = {
      title: 'Error Title',
      message: 'Error Message',
    };
    render(<ImagePreview {...defaultProps} error={error} isLoading={true} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Should show loading state instead
    expect(screen.getByRole('status', { name: 'Generating image...' })).toBeInTheDocument();
  });

  it('should not show duplicate message when error title and message are the same', () => {
    const error = {
      title: 'Failed to generate image',
      message: 'Failed to generate image',
    };
    render(<ImagePreview {...defaultProps} error={error} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate image')).toBeInTheDocument();
    // Check that the message doesn't appear twice by counting occurrences
    expect(screen.getAllByText('Failed to generate image')).toHaveLength(1);
  });
});
