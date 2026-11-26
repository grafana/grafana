import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { Select, MultiSelect, AsyncSelect, AsyncMultiSelect } from './Select';

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

describe('data attributes', () => {
  const loadOptions = async () => [];

  it.each([
    ['Select', () => <Select onChange={() => {}} options={[]} data-analytics-id="datasource_picked" />],
    ['MultiSelect', () => <MultiSelect onChange={() => {}} options={[]} data-analytics-id="datasource_picked" />],
    [
      'AsyncSelect',
      () => <AsyncSelect onChange={() => {}} loadOptions={loadOptions} data-analytics-id="datasource_picked" />,
    ],
    [
      'AsyncMultiSelect',
      () => <AsyncMultiSelect onChange={() => {}} loadOptions={loadOptions} data-analytics-id="datasource_picked" />,
    ],
  ])('%s forwards data attributes to the combobox input only', (_name, renderSelect) => {
    render(renderSelect());

    const tagged = document.querySelectorAll('[data-analytics-id]');
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toBe(screen.getByRole('combobox'));
    expect(tagged[0]).toHaveAttribute('data-analytics-id', 'datasource_picked');
  });

  it('keeps the input data-testid alongside other data attributes', () => {
    render(<Select onChange={() => {}} options={[]} data-testid="my-select" data-analytics-id="datasource_picked" />);

    const input = screen.getByTestId('my-select-input');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('data-analytics-id', 'datasource_picked');
  });

  it('does not forward props that are not data attributes to the input', () => {
    const spreadProps = { title: 'Spread title', 'data-analytics-id': 'datasource_picked' };
    render(<Select onChange={() => {}} options={[]} {...spreadProps} />);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('data-analytics-id', 'datasource_picked');
    expect(input).not.toHaveAttribute('title');
  });
});
