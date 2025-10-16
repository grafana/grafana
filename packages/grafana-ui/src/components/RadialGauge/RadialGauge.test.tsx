import { render, screen } from '@testing-library/react';

import { RadialGaugeExample } from './RadialGauge.story';

describe('RadialGauge', () => {
  it('should render', () => {
    render(<RadialGaugeExample />);

    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
