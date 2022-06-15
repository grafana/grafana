import { render, screen } from '@testing-library/react';
import React from 'react';

import { AbstractList } from './AbstractList';

describe('AbstractList', () => {
  it('renders items using renderItem prop function', () => {
    const items = [
      { name: 'Item 1', id: 'item1' },
      { name: 'Item 2', id: 'item2' },
      { name: 'Item 3', id: 'item3' },
    ];

    render(
      <AbstractList
        items={items}
        renderItem={(item) => (
          <div>
            <h1>{item.name}</h1>
            <small>{item.id}</small>
          </div>
        )}
      />
    );

    expect(screen.getByRole('heading', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.getByText('item1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Item 2' })).toBeInTheDocument();
    expect(screen.getByText('item2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Item 3' })).toBeInTheDocument();
    expect(screen.getByText('item3')).toBeInTheDocument();
  });
});
