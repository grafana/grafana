import { render, screen } from '@testing-library/react';

import { RadialGaugeExample } from './RadialGauge.story';

describe('RadialGauge', () => {
  it('should render', () => {
    render(<RadialGaugeExample />);

    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('should render threshold labels', () => {
    render(<RadialGaugeExample showScaleLabels={true} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByLabelText('Threshold 85')).toBeInTheDocument();
  });
});
