import { render, screen } from 'test/test-utils';

import { IntervalIndicator } from './IntervalIndicator';

describe('IntervalIndicator', () => {
  it('names the interval and explains it in a tooltip', async () => {
    const { user } = render(<IntervalIndicator interval="10m" />);

    const chip = screen.getByRole('img', { name: 'Evaluated every 10m' });
    expect(chip).toHaveTextContent('10m');
    await user.hover(chip);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Evaluated every 10m');
  });

  it('renders nothing without an interval', () => {
    const { container } = render(<IntervalIndicator />);

    expect(container).toBeEmptyDOMElement();
  });
});
