import { render, screen } from '@testing-library/react';

import { RadioButtonGroup } from './RadioButtonGroup';

describe('RadioButtonGroup', () => {
  it('uses option label as title on each radio button', () => {
    render(
      <RadioButtonGroup
        value="both"
        options={[
          { label: 'Candles', value: 'candles' },
          { label: 'Volume', value: 'volume' },
          { label: 'Candles and volume', value: 'both' },
        ]}
      />
    );

    expect(screen.getByRole('radio', { name: 'Candles and volume' })).toHaveAttribute('title', 'Candles and volume');
  });

  it('falls back to aria-label when no option label is present', () => {
    render(<RadioButtonGroup value="a" options={[{ value: 'a', ariaLabel: 'Fallback option' }]} />);

    const radio = screen.getByRole('radio', { name: 'Fallback option' });
    expect(radio).toHaveAttribute('title', 'Fallback option');
    const label = radio.nextElementSibling;
    expect(label).toHaveAttribute('title', 'Fallback option');
  });
});
