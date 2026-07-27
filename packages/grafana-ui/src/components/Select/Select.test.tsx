import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { MultiSelect, AsyncMultiSelect } from './Select';

describe('MultiSelect', () => {
  it('exposes the MultiSelect container data-testid', () => {
    render(<MultiSelect onChange={() => {}} options={[]} />);
    expect(screen.getByTestId(selectors.components.MultiSelect.container)).toBeInTheDocument();
  });

  it('lets the consumer override the data-testid', () => {
    render(<MultiSelect onChange={() => {}} options={[]} data-testid="custom-multi" />);
    expect(screen.getByTestId('custom-multi')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.MultiSelect.container)).not.toBeInTheDocument();
  });
});

describe('AsyncMultiSelect', () => {
  it('exposes the MultiSelect container data-testid', () => {
    render(<AsyncMultiSelect onChange={() => {}} loadOptions={async () => []} />);
    expect(screen.getByTestId(selectors.components.MultiSelect.container)).toBeInTheDocument();
  });

  it('lets the consumer override the data-testid', () => {
    render(<AsyncMultiSelect onChange={() => {}} loadOptions={async () => []} data-testid="custom-async-multi" />);
    expect(screen.getByTestId('custom-async-multi')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.MultiSelect.container)).not.toBeInTheDocument();
  });
});
