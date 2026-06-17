import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { UnitPicker } from './UnitPicker';

describe('UnitPicker', () => {
  it('exposes the UnitPicker container data-testid', () => {
    render(<UnitPicker onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.UnitPicker.container)).toBeInTheDocument();
  });
});
