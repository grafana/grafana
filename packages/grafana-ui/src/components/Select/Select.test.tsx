import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { MultiSelect, AsyncMultiSelect } from './Select';

describe('MultiSelect', () => {
  it('exposes the MultiSelect container data-testid', () => {
    render(<MultiSelect onChange={() => {}} options={[]} />);
    expect(screen.getByTestId(selectors.components.MultiSelect.container)).toBeInTheDocument();
  });
});

describe('AsyncMultiSelect', () => {
  it('exposes the MultiSelect container data-testid', () => {
    render(<AsyncMultiSelect onChange={() => {}} loadOptions={async () => []} />);
    expect(screen.getByTestId(selectors.components.MultiSelect.container)).toBeInTheDocument();
  });
});
