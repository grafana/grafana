import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Carousel } from './Carousel';

const testImages = [
  {
    path: 'https://grafana.com/static/img/alerting/grafana-alerting-enterprise-scale-mimir-and-loki.png/apple-touch-icon.png',
    name: 'Alert rule',
  },
  { path: 'https://grafana.com/static/img/screenshots/grafana_dash.jpeg', name: 'Dashboard' },
  { path: 'https://grafana.com/static/img/screenshots/metrics.jpg', name: 'Metrics' },
  { path: 'https://grafana.com/static/img/screenshots/traces.jpg', name: 'Traces' },
];

describe('Carousel', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('renders the component with all images', () => {
    render(<Carousel images={testImages} />);

    testImages.forEach((image) => {
      const name = screen.getByText(image.name);
      expect(name).toBeInTheDocument();
      const imageElement = document.querySelector(`img[src="${image.path}"]`);
      expect(imageElement).toBeInTheDocument();
    });
  });

  it('shows full-screen preview when clicking on an image', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));

    const fullScreenElement = screen.getByTestId('carousel-full-screen');
    expect(fullScreenElement).toBeInTheDocument();

    const previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toBeInTheDocument();
    expect(previewImage).toHaveAttribute('src', testImages[0].path);
    expect(previewImage).toHaveAttribute('alt', testImages[0].name);
  });

  it('closes the preview when clicking the close button', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));
    expect(screen.getByLabelText('Close')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    });
  });

  it('navigates to next image when clicking the next button', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));

    await user.click(screen.getByTestId('next-button'));

    // Verify we're on the second image
    const previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[1].path);
    expect(previewImage).toHaveAttribute('alt', testImages[1].name);
  });

  it('navigates to previous image when clicking the previous button', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Dashboard'));

    await user.click(screen.getByTestId('previous-button'));

    const previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[0].path);
    expect(previewImage).toHaveAttribute('alt', testImages[0].name);
  });

  it('wraps around to the first image when clicking next on the last image', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Traces'));

    await user.click(screen.getByTestId('next-button'));

    const previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[0].path);
    expect(previewImage).toHaveAttribute('alt', testImages[0].name);
  });

  it('wraps around to the last image when clicking previous on the first image', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));

    await user.click(screen.getByTestId('previous-button'));

    const previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[3].path);
    expect(previewImage).toHaveAttribute('alt', testImages[3].name);
  });

  it('navigates with keyboard arrow keys', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));

    await user.keyboard('{ArrowRight}');

    let previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[1].path);

    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowLeft}');

    previewImage = screen.getByTestId('carousel-full-image').querySelector('img');
    expect(previewImage).toHaveAttribute('src', testImages[3].path);
  });

  it('closes the preview with the escape key', async () => {
    render(<Carousel images={testImages} />);

    await user.click(screen.getByText('Alert rule'));
    expect(screen.getByTestId('carousel-full-screen')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('carousel-full-screen')).not.toBeInTheDocument();
  });

  it('shows warning when all images fail to load', async () => {
    const originalConsoleError = console.error;
    console.error = jest.fn();

    render(<Carousel images={testImages} />);

    const images = screen.getAllByRole('presentation');
    images.forEach((img) => {
      fireEvent.error(img);
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
    });

    console.error = originalConsoleError;
  });
});
