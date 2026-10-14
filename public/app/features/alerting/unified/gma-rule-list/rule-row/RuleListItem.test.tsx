import { render, screen } from 'test/test-utils';

import { RuleListItem, RuleListItemDescription } from './RuleListItem';

describe('RuleListItem', () => {
  it('VIS-1: renders title, description, actions and separates only truthy meta entries with a pipe', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          description="desc"
          meta={[<span key="a">first</span>, null, false, <span key="b">second</span>, <span key="c">third</span>]}
          actions={<button>Edit</button>}
        />
      </ul>
    );

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByText('My rule')).toBeInTheDocument();
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getAllByText('|')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows the error instead of the summary when both exist', () => {
    render(<RuleListItemDescription error="boom" summary="all good" />);

    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
  });

  it('falls back to the summary without an error', () => {
    render(<RuleListItemDescription summary="all good" />);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});
