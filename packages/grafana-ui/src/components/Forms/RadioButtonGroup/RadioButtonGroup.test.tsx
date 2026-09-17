import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { getDataTestId, RadioButtonGroup } from './RadioButtonGroup';

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

  it('uses option dataTestId as "data-testid" attribute on each radio button', () => {
    render(
      <RadioButtonGroup
        value="both"
        options={[
          { label: 'Candles', value: 'candles', dataTestId: 'data-testid order-form option candles' },
          { label: 'Volume', value: 'volume', dataTestId: 'data-testid order-form option volume' },
          {
            label: 'Candles and volume',
            value: 'both',
            dataTestId: 'data-testid order-form option candles and volumes',
          },
        ]}
      />
    );

    expect(screen.getByTestId('data-testid order-form option candles')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid order-form option volume')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid order-form option candles and volumes')).toBeInTheDocument();
  });

  it('uses default selector if dataTestId is missing as "data-testid" attribute on each radio button', () => {
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

    expect(screen.getByTestId(selectors.components.RadioButton.option('candles'))).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.RadioButton.option('volume'))).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.RadioButton.option('both'))).toBeInTheDocument();
  });
});

describe('getDataTestId', () => {
  it('should return dataTestId from option if present', () => {
    expect(getDataTestId({ dataTestId: 'a data test id' })).toBe('a data test id');
  });

  it('should use generic selector from a "string" value on the option if present', () => {
    expect(getDataTestId({ value: 'a data test id' })).toBe('data-testid radio-button-option a data test id');
  });

  it('should use generic selector from a "number" value on the option if present', () => {
    expect(getDataTestId({ value: 0 })).toBe('data-testid radio-button-option 0');
  });

  it('should use generic selector from a "boolean" value on the option if present', () => {
    expect(getDataTestId({ value: false })).toBe('data-testid radio-button-option false');
  });

  it('should return undefined when dataTestId is missing and value is not a "string", "number" or "boolean"', () => {
    expect(getDataTestId({ value: {} })).toBeUndefined();
    expect(getDataTestId({ value: () => {} })).toBeUndefined();
    expect(getDataTestId({ value: undefined })).toBeUndefined();
    expect(getDataTestId({ value: null })).toBeUndefined();
  });
});
