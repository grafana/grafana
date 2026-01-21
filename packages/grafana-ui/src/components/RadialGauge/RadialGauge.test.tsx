import { render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

import { ThresholdsMode } from '@grafana/schema';

import { RadialGaugeExample } from './RadialGauge.story';

describe('RadialGauge', () => {
  it.each([
    { description: 'default', props: {} },
    { description: 'gauge shape', props: { shape: 'gauge' } },
    { description: 'with gradient', props: { gradient: true } },
    { description: 'with glow bar', props: { glowBar: true } },
    { description: 'with glow center', props: { glowCenter: true } },
    { description: 'with segments', props: { segmentCount: 5 } },
    { description: 'with rounded bars', props: { roundedBars: true } },
    { description: 'with endpoint marker glow', props: { roundedBars: true, endpointMarker: 'glow' } },
    { description: 'with endpoint marker point', props: { roundedBars: true, endpointMarker: 'point' } },
    { description: 'with thresholds bar', props: { thresholdsBar: true } },
    { description: 'with sparkline', props: { sparkline: true } },
    { description: 'with neutral value', props: { neutral: 50 } },
  ] satisfies Array<{ description: string; props?: ComponentProps<typeof RadialGaugeExample> }>)(
    'should render $description without throwing',
    ({ props }) => {
      render(<RadialGaugeExample {...props} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    }
  );

  describe('labels', () => {
    it('should render labels', () => {
      render(<RadialGaugeExample showScaleLabels />);

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
    });

    it('should render labels including neutral', () => {
      render(<RadialGaugeExample showScaleLabels neutral={50} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
      expect(screen.getByLabelText('Neutral 50')).toBeInTheDocument();
    });

    it('should not render a threshold if it is out of range', () => {
      render(
        <RadialGaugeExample
          showScaleLabels
          thresholds={{
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 200, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 65')).toBeInTheDocument();
      expect(screen.queryByLabelText('Threshold 200')).not.toBeInTheDocument();
    });

    it('should not render neutral if it is out of range', () => {
      render(<RadialGaugeExample showScaleLabels neutral={-50} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
      expect(screen.queryByLabelText('Neutral -50')).not.toBeInTheDocument();
    });

    it('should not render neutral if it duplicates a threshold value', () => {
      render(<RadialGaugeExample showScaleLabels neutral={85} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
      expect(screen.queryByLabelText('Neutral 85')).not.toBeInTheDocument();
    });
  });

  describe('thresholds bar', () => {
    it('should render thresholds bar if some thresholds are in range', () => {
      render(
        <RadialGaugeExample
          thresholdsBar
          min={50}
          max={150}
          thresholds={{
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: 0, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 200, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getAllByTestId('radial-gauge-thresholds-bar')).toHaveLength(2);
    });

    it('should not render thresholds bar if min === max', () => {
      render(
        <RadialGaugeExample
          thresholdsBar
          min={1}
          max={1}
          thresholds={{
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: 1, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 200, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByTestId('radial-gauge-thresholds-bar')).not.toBeInTheDocument();
    });

    it.skip('should not render thresholds bar the prop is not set', () => {
      render(
        <RadialGaugeExample
          min={50}
          max={150}
          thresholds={{
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: 0, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 200, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByTestId('radial-gauge-thresholds-bar')).not.toBeInTheDocument();
    });
  });
});
