import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { Switch, InlineSwitch } from './Switch';

describe('Switch', () => {
  it('exposes the Switch container data-testid', () => {
    render(<Switch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.Switch.container)).toBeInTheDocument();
  });

  it('lets the consumer override the data-testid', () => {
    render(<Switch onChange={() => {}} data-testid="custom-switch" />);
    expect(screen.getByTestId('custom-switch')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Switch.container)).not.toBeInTheDocument();
  });
});

describe('InlineSwitch', () => {
  it('exposes the InlineSwitch container data-testid', () => {
    render(<InlineSwitch onChange={() => {}} />);
    expect(screen.getByTestId(selectors.components.InlineSwitch.container)).toBeInTheDocument();
  });

  it('does not also carry the Switch container data-testid', () => {
    render(<InlineSwitch onChange={() => {}} />);
    expect(screen.queryByTestId(selectors.components.Switch.container)).not.toBeInTheDocument();
  });
});
