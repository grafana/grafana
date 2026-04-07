import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SearchableList } from './SearchableList';

const items = [
  { id: '1', label: 'Grafana dashboard' },
  { id: '2', label: 'Prometheus metrics' },
  { id: '3', label: 'Loki logs' },
];

describe('SearchableList', () => {
  it('renders all items when no query is entered', () => {
    render(<SearchableList items={items} />);
    expect(screen.getByText('Grafana dashboard')).toBeInTheDocument();
    expect(screen.getByText('Prometheus metrics')).toBeInTheDocument();
    expect(screen.getByText('Loki logs')).toBeInTheDocument();
  });

  it('filters items based on search query', async () => {
    render(<SearchableList items={items} />);
    await userEvent.type(screen.getByRole('textbox'), 'graf');
    expect(screen.queryByText('Prometheus metrics')).not.toBeInTheDocument();
    expect(screen.queryByText('Loki logs')).not.toBeInTheDocument();
  });

  it('shows no results message when nothing matches', async () => {
    render(<SearchableList items={items} />);
    await userEvent.type(screen.getByRole('textbox'), 'zzz');
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });
});
