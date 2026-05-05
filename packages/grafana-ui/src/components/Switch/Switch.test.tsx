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
  it('exposes the InlineSwitch container data-testid', () => {
    render(<InlineSwitch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.InlineSwitch.container)).toBeInTheDocument();
  });

  it('still nests a Switch with its own data-testid', () => {
    render(<InlineSwitch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.Switch.container)).toBeInTheDocument();
  });
});
