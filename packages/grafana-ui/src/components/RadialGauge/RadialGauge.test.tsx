import { render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';

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

  describe('text mode', () => {
    describe('auto mode', () => {
      it('should render `value_and_name` if the vizCount is greater than 1', () => {
        render(<RadialGaugeExample textMode="auto" vizCount={3} value={55} />);
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByText('TestData')).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
      });

      it('should render `value_and_name` if the vizCount is 1 and the first value has a display name', () => {
        render(<RadialGaugeExample textMode="auto" seriesName="My series" vizCount={3} value={55} />);
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByText('My series')).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
      });

      it('should render `value` if the vizCount is 1 and the first value has no display name', () => {
        render(<RadialGaugeExample textMode="auto" vizCount={1} value={55} />);
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.queryByText('TestData')).not.toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
      });
    });

    it('should render `value_and_name` if the textMode is set to `value_and_name`', () => {
      render(<RadialGaugeExample textMode="value_and_name" seriesName="My series" value={55} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText('My series')).toBeInTheDocument();
      expect(screen.getByText('55')).toBeInTheDocument();
    });

    it('should render `value` if the textMode is set to `value`', () => {
      render(<RadialGaugeExample textMode="value" seriesName="My series" value={55} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByText('My series')).not.toBeInTheDocument();
      expect(screen.getByText('55')).toBeInTheDocument();
    });

    it('should render `name` if the textMode is set to `name`', () => {
      render(<RadialGaugeExample textMode="name" seriesName="My series" value={55} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText('My series')).toBeInTheDocument();
      expect(screen.queryByText('55')).not.toBeInTheDocument();
    });

    it('should render `none` if the textMode is set to `none`', () => {
      render(<RadialGaugeExample textMode="none" seriesName="My series" value={55} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByText('My series')).not.toBeInTheDocument();
      expect(screen.queryByText('55')).not.toBeInTheDocument();
    });
  });

  describe('labels', () => {
    it('should render labels', () => {
      render(<RadialGaugeExample showScaleLabels />);

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
    });

    it('should render labels for a circle gauge', () => {
      render(<RadialGaugeExample showScaleLabels shape="circle" />);

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

    it('should render percentage labels', () => {
      render(
        <RadialGaugeExample
          showScaleLabels
          min={50}
          max={150}
          thresholds={{
            mode: ThresholdsMode.Percentage,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 90, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 0%')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 65%')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 90%')).toBeInTheDocument();
      expect(screen.getByLabelText('Threshold 100%')).toBeInTheDocument();
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

    it('should render thresholds bar for percentage thresholds', () => {
      render(
        <RadialGaugeExample
          thresholdsBar
          min={200}
          max={300}
          thresholds={{
            mode: ThresholdsMode.Percentage,
            steps: [
              { value: 0, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 90, color: 'red' },
            ],
          }}
        />
      );

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getAllByTestId('radial-gauge-thresholds-bar')).toHaveLength(3);
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

    it('should not render thresholds bar if the prop is not set', () => {
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
