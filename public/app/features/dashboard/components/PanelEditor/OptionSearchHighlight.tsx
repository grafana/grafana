import Highlighter from 'react-highlight-words';

export function highlightOptionSearchTerm(text: string, query: string) {
  return <Highlighter textToHighlight={text} searchWords={[query]} highlightClassName="search-fragment-highlight" />;
}
