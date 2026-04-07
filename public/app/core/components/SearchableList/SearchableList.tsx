import React, { useState } from 'react';

export interface SearchableItem {
  id: string;
  label: string;
}

interface Props {
  items: SearchableItem[];
  placeholder?: string;
}

interface HighlightedLabelProps {
  text: string;
  query: string;
}

function HighlightedLabel({ text, query }: HighlightedLabelProps) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return <>{text}</>;
  }
  const index = text.toLowerCase().indexOf(trimmedQuery);
  if (index === -1) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + trimmedQuery.length)}</mark>
      {text.slice(index + trimmedQuery.length)}
    </>
  );
}

export function SearchableList({ items, placeholder = 'Search...' }: Props) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const filteredItems = trimmedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(trimmedQuery.toLowerCase()))
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
          <li key={item.id}>
            <HighlightedLabel text={item.label} query={query} />
          </li>
        ))}
      </ul>
    </div>
  );
}
