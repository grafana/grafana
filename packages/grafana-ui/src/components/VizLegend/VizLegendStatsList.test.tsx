import { render, screen } from '@testing-library/react';

import type { DisplayValue } from '@grafana/data/types';

import { VizLegendStatsList } from './VizLegendStatsList';

function makeStat(overrides: Partial<DisplayValue> = {}): DisplayValue {
  return { numeric: 42, text: '42', ...overrides };
}

describe('VizLegendStatsList', () => {
  it('returns null when stats array is empty', () => {
    const { container } = render(<VizLegendStatsList stats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders capitalized title prefix with value, and omits prefix when title is missing', () => {
    render(<VizLegendStatsList stats={[makeStat({ title: 'mean', text: '50' }), makeStat({ text: '77' })]} />);
    expect(screen.getByText(/Mean:/)).toBeInTheDocument();
    expect(screen.getByText(/77/)).not.toHaveTextContent(/:/);
  });

  it('sets description as the title attribute', () => {
    render(<VizLegendStatsList stats={[makeStat({ text: '55', description: 'some tooltip' })]} />);
    expect(screen.getByTitle('some tooltip')).toBeInTheDocument();
  });
});
