import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type ScopeSpecFilter } from '@grafana/data';

import { ScopeMetadata, hasScopeMetadata } from './ScopeMetadata';

describe('hasScopeMetadata', () => {
  it.each<{ desc: string; description?: string; filters?: ScopeSpecFilter[]; expected: boolean }>([
    { desc: 'nothing is set', expected: false },
    { desc: 'filters are empty', filters: [], expected: false },
    { desc: 'only a description is set', description: 'A scope', expected: true },
    { desc: 'only filters are set', filters: [{ key: 'a', operator: 'equals', value: 'b' }], expected: true },
  ])('returns $expected when $desc', ({ description, filters, expected }) => {
    expect(hasScopeMetadata({ description, filters })).toBe(expected);
  });
});

describe('ScopeMetadata', () => {
  it('renders the description and filters under their headers', () => {
    render(
      <ScopeMetadata
        description="Production Vault cluster"
        filters={[{ key: 'cluster', operator: 'equals', value: 'prod-us-central-0' }]}
      />
    );

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Production Vault cluster')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('cluster = prod-us-central-0')).toBeInTheDocument();
  });

  it.each<{ filter: ScopeSpecFilter; text: string }>([
    { filter: { key: 'env', operator: 'not-equals', value: 'dev' }, text: 'env != dev' },
    { filter: { key: 'region', operator: 'one-of', value: '', values: ['us', 'eu'] }, text: 'region =| us, eu' },
  ])('formats a $filter.operator filter as "$text"', ({ filter, text }) => {
    render(<ScopeMetadata filters={[filter]} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('omits the Description header when there is no description', () => {
    render(<ScopeMetadata filters={[{ key: 'a', operator: 'equals', value: 'b' }]} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('omits the Filters header when there are no filters', () => {
    render(<ScopeMetadata description="Only a description" filters={[]} />);

    expect(screen.getByText('Only a description')).toBeInTheDocument();
    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });
});
