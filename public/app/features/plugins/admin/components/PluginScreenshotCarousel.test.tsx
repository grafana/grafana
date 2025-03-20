import { render, screen, fireEvent } from 'test/test-utils';

import { PluginSignatureStatus } from '@grafana/data';

import { CatalogPlugin } from '../types';

import { PluginScreenshotCarousel } from './PluginScreenshotCarousel';

const mockPlugin: CatalogPlugin = {
  id: 'test-plugin',
  latestVersion: '1.0.0',
  description: 'Test plugin description',
  downloads: 1000,
  hasUpdate: false,
  info: {
    logos: {
      small: 'small-logo-url',
      large: 'large-logo-url',
    },
    keywords: ['test', 'plugin'],
  },
  isDev: false,
  isCore: false,
  isEnterprise: false,
  isInstalled: true,
  isDisabled: false,
  isDeprecated: false,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
  isPublished: true,
  name: 'Test Plugin',
  orgName: 'Test Org',
  signature: PluginSignatureStatus.valid,
  popularity: 100,
  publishedAt: '2021-01-01',
  updatedAt: '2021-01-01',
};

const mockScreenshots = [
  { path: 'screenshot1.png', name: 'Dashboard Overview' },
  { path: 'screenshot2.png', name: 'Settings Panel' },
  { path: 'screenshot3.png', name: 'Visualization Example' },
];

describe('PluginScreenshotCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the grid of screenshots', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(mockScreenshots.length);

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByText('Settings Panel')).toBeInTheDocument();
    expect(screen.getByText('Visualization Example')).toBeInTheDocument();
  });

  it('should open fullscreen preview when a screenshot is clicked', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);
    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toBeInTheDocument();

    expect(screen.getByLabelText('Previous')).toBeInTheDocument();
    expect(screen.getByLabelText('Next')).toBeInTheDocument();
  });

  it('should close preview when close button is clicked', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('should navigate to next image when next button is clicked', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const fullScreenImage = screen.getAllByRole('img')[mockScreenshots.length]; // Get the fullscreen image
    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot1.png'
    );

    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot2.png'
    );
  });

  it('should navigate to previous image when previous button is clicked', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);
    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    const fullScreenImage = screen.getAllByRole('img')[mockScreenshots.length];
    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot3.png'
    );

    const previousButton = screen.getByLabelText('Previous');
    fireEvent.click(previousButton);

    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot2.png'
    );
  });

  it('should handle keyboard navigation', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const container = screen.getByTestId('plugin-screenshot-full-screen');

    fireEvent.keyDown(container, { key: 'ArrowRight' });

    const fullScreenImage = screen.getAllByRole('img')[mockScreenshots.length];
    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot2.png'
    );

    fireEvent.keyDown(container, { key: 'ArrowLeft' });

    expect(fullScreenImage).toHaveAttribute(
      'src',
      '/api/gnet/plugins/test-plugin/versions/1.0.0/images/screenshot1.png'
    );

    fireEvent.keyDown(container, { key: 'Escape' });

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('should filter out images that fail to load', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const images = screen.getAllByRole('img');
    fireEvent.error(images[0]);

    expect(screen.queryByText('Something went wrong loading screenshots')).not.toBeInTheDocument();

    const remainingImages = screen.getAllByRole('img');
    expect(remainingImages).toHaveLength(2);

    expect(screen.queryByText('Dashboard Overview')).not.toBeInTheDocument();
    expect(screen.getByText('Settings Panel')).toBeInTheDocument();
    expect(screen.getByText('Visualization Example')).toBeInTheDocument();
  });

  it('should show a warning when all screenshots fail to load', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const images = screen.getAllByRole('img');
    fireEvent.error(images[0]);
    fireEvent.error(images[1]);
    fireEvent.error(images[2]);

    expect(screen.getByText('Something went wrong loading screenshots')).toBeInTheDocument();
  });

  it('should close preview when clicking outside the image', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const backdrop = screen.getByTestId('plugin-screenshot-full-screen');
    fireEvent.click(backdrop);

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('should not close preview when clicking on the image', () => {
    render(<PluginScreenshotCarousel plugin={mockPlugin} screenshots={mockScreenshots} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    const fullScreenImage = screen.getByTestId('plugin-screenshot-full-image');

    fireEvent.click(fullScreenImage);

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
