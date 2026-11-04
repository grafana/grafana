import Highlighter from 'react-highlight-words';

export function CellOptionSearchLabel({ label, searchQuery }: { label: string; searchQuery?: string }) {
  return searchQuery ? (
    <Highlighter textToHighlight={label} searchWords={[searchQuery]} highlightClassName="search-fragment-highlight" />
  ) : (
    label
  );
}
