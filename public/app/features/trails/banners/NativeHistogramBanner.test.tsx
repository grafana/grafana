import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrail } from '../DataTrail';
import { MetricSelectedEvent } from '../shared';

import { NativeHistogramBanner } from './NativeHistogramBanner';

const mockTrail = {
  publishEvent: jest.fn(),
} as unknown as DataTrail;

const mockProps = {
  histogramsLoaded: true,
  nativeHistograms: ['histogram1', 'histogram2'],
  trail: mockTrail,
};

describe('NativeHistogramBanner', () => {
  test('renders correctly when histograms are loaded', () => {
    render(<NativeHistogramBanner {...mockProps} />);
    expect(screen.getByText('Native Histogram Support')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Prometheus native histograms offer high resolution, high precision, simple usage in instrumentation and a way to combine and manipulate histograms in queries and in Grafana.'
      )
    ).toBeInTheDocument();
  });

  test('Has a learn more button works', () => {
    render(<NativeHistogramBanner {...mockProps} />);
    const learnMoreButton = screen.getByText('Learn more');
    expect(learnMoreButton).toBeInTheDocument();
  });

  test('See examples button works', () => {
    render(<NativeHistogramBanner {...mockProps} />);
    const seeExamplesButton = screen.getByText('> See examples');
    expect(seeExamplesButton).toBeInTheDocument();
    fireEvent.click(seeExamplesButton);
    expect(screen.getByText('Native Histogram displayed as heatmap:')).toBeInTheDocument();
    expect(screen.getByText('Native Histogram displayed as histogram:')).toBeInTheDocument();
    expect(screen.getByText('Classic Histogram displayed as heatmap:')).toBeInTheDocument();
    expect(screen.getByText('Classic Histogram displayed as histogram:')).toBeInTheDocument();
  });

  test('Native histograms buttons work', () => {
    render(<NativeHistogramBanner {...mockProps} />);
    fireEvent.click(screen.getByText('> See examples'));
    const histogramButton = screen.getByText('histogram1');
    expect(histogramButton).toBeInTheDocument();
    fireEvent.click(histogramButton);
    expect(mockTrail.publishEvent).toHaveBeenCalledWith(new MetricSelectedEvent('histogram1'), true);
  });

  test('Set that the banner has been shown in local storage when a user closes the banner', () => {
    render(<NativeHistogramBanner {...mockProps} />);
    // click the button with aria label "Close alert"
    fireEvent.click(screen.getByLabelText('Close alert'));
    expect(localStorage.getItem('nativeHistogramBanner')).toBe('true');
  });
});
