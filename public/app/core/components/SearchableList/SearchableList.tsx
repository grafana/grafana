import React, { useState } from 'react';

import { highlightMatch } from '../../utils/highlightMatch';

export interface SearchableItem {
  id: string;
  label: string;
}

interface Props {
  items: SearchableItem[];
  placeholder?: string;
}

export function SearchableList({ items, placeholder = 'Search...' }: Props) {
  const [query, setQuery] = useState('');

  const filteredItems = query
    ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      <ul>
        {filteredItems.length === 0 && <li>No results found.</li>}
        {filteredItems.map((item) => (
          <li key={item.id} dangerouslySetInnerHTML={{ __html: highlightMatch(item.label, query) }} />
        ))}
      </ul>
    </div>
  );
}
