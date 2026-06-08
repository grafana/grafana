import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { RadioButtonGroup } from './RadioButtonGroup';

describe('RadioButtonGroup', () => {
  it('exposes the RadioGroup container data-testid', () => {
    render(
      <RadioButtonGroup
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]}
        value="a"
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId(selectors.components.RadioGroup.container)).toBeInTheDocument();
  });

  it('lets the consumer override the data-testid', () => {
    render(
      <RadioButtonGroup
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]}
        value="a"
        onChange={() => {}}
        data-testid="custom-radio-group"
      />
    );
    expect(screen.getByTestId('custom-radio-group')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.RadioGroup.container)).not.toBeInTheDocument();
  });

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
