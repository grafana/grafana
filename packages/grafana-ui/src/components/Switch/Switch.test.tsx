import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { Switch, InlineSwitch } from './Switch';

describe('Switch', () => {
  it('exposes the Switch container data-testid', () => {
    render(<Switch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.Switch.container)).toBeInTheDocument();
  });
});

describe('InlineSwitch', () => {
  it('exposes the Switch container data-testid via the inner Switch', () => {
    render(<InlineSwitch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.Switch.container)).toBeInTheDocument();
  });
});
