import { render, screen } from '@testing-library/react';

import { CompletionItemGroup } from '../../types/completion';

import { Typeahead } from './Typeahead';

describe('Typeahead', () => {
  const completionItemGroups: CompletionItemGroup[] = [{ label: 'my group', items: [{ label: 'first item' }] }];

  describe('when closed', () => {
    it('renders nothing when no items given', () => {
      render(<Typeahead origin="test" groupedItems={[]} />);
      expect(screen.queryByTestId('typeahead')).not.toBeInTheDocument();
    });

    it('renders nothing when items given', () => {
      render(<Typeahead origin="test" groupedItems={completionItemGroups} />);
      expect(screen.queryByTestId('typeahead')).not.toBeInTheDocument();
    });
  });

  describe('when open', () => {
    it('renders given items and nothing is selected', () => {
      render(<Typeahead origin="test" groupedItems={completionItemGroups} isOpen />);
      expect(screen.getByTestId('typeahead')).toBeInTheDocument();

      const groupTitles = screen.getAllByRole('listitem');
      expect(groupTitles).toHaveLength(1);
      expect(groupTitles[0]).toHaveTextContent('my group');
      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('first item');
    });

    it('can be rendered properly even if the size of items is large', () => {
      const completionItemGroups: CompletionItemGroup[] = [{ label: 'my group', items: [] }];
      const itemsSize = 1000000;
      for (let i = 0; i < itemsSize; i++) {
        completionItemGroups[0].items.push({ label: 'item' + i });
      }

      render(<Typeahead origin="test" groupedItems={completionItemGroups} isOpen />);
      expect(screen.getByTestId('typeahead')).toBeInTheDocument();
    });
  });
});
