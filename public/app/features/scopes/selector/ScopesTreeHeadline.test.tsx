import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { ScopesTreeHeadline } from './ScopesTreeHeadline';

const node = { scopeNodeId: 'a', expanded: false, query: '' };

describe('ScopesTreeHeadline', () => {
  it('renders nothing when there is no query', () => {
    render(<ScopesTreeHeadline anyChildExpanded={false} query="" resultsNodes={[node]} />);

    expect(screen.queryByTestId('scopes-tree-headline')).not.toBeInTheDocument();
  });

  it('shows "Results" when a query has matches', () => {
    render(<ScopesTreeHeadline anyChildExpanded={false} query="vault" resultsNodes={[node]} />);

    expect(screen.getByTestId('scopes-tree-headline')).toHaveTextContent('Results');
  });

  it('shows the no results message when a query has no matches', () => {
    render(<ScopesTreeHeadline anyChildExpanded={false} query="zzz" resultsNodes={[]} />);

    expect(screen.getByTestId('scopes-tree-headline')).toHaveTextContent('No results found for your query');
  });

  it('renders nothing when a child is expanded', () => {
    render(<ScopesTreeHeadline anyChildExpanded query="vault" resultsNodes={[node]} />);

    expect(screen.queryByTestId('scopes-tree-headline')).not.toBeInTheDocument();
  });
});
