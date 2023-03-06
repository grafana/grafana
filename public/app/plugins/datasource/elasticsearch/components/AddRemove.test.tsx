import { render, screen } from '@testing-library/react';
import React from 'react';

import { AddRemove } from './AddRemove';

const noop = () => {};

const TestComponent = ({ items }: { items: string[] }) => (
  <>
    {items.map((_, index) => (
      <AddRemove key={index} elements={items} index={index} onAdd={noop} onRemove={noop} />
    ))}
  </>
);

describe('AddRemove Button', () => {
  describe("When There's only one element in the list", () => {
    it('Should only show the add button', () => {
      render(<TestComponent items={['something']} />);

      expect(screen.getByText('add')).toBeInTheDocument();
      expect(screen.queryByText('remove')).not.toBeInTheDocument();
    });
  });

  describe("When There's more than one element in the list", () => {
    it('Should show the remove button on every element', () => {
      const items = ['something', 'something else'];

      render(<TestComponent items={items} />);

      expect(screen.getAllByText('remove')).toHaveLength(items.length);
    });

    it('Should show the add button only once', () => {
      const items = ['something', 'something else'];

      render(<TestComponent items={items} />);

      expect(screen.getAllByText('add')).toHaveLength(1);
    });
  });
});
