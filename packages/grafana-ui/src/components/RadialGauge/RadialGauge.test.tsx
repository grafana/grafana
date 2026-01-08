import { render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

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

  it('should render threshold labels', () => {
    render(<RadialGaugeExample showScaleLabels={true} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
  });
});
