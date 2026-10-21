import { render, screen } from 'test/test-utils';

import { RuleListItem, RuleListItemDescription } from './RuleListItem';

describe('RuleListItem', () => {
  it('renders title, description, actions and only the truthy meta entries', () => {
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
    expect(screen.getAllByTestId('rule-meta-item').map((item) => item.textContent)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('RuleListItemDescription', () => {
  it.each([
    {
      name: 'the error instead of the summary when both exist',
      props: { error: 'boom', summary: 'all good' },
      shown: 'boom',
      hidden: 'all good',
    },
    { name: 'the summary without an error', props: { summary: 'all good' }, shown: 'all good', hidden: 'boom' },
  ])('shows $name', ({ props, shown, hidden }) => {
    render(<RuleListItemDescription {...props} />);

    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });
});
