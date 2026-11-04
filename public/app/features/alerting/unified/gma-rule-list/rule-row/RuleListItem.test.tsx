import { render, screen } from 'test/test-utils';

import { RuleListItem } from './RuleListItem';

describe('RuleListItem', () => {
  it('renders the title and only the truthy meta entries, in order', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          meta={[<span key="a">first</span>, null, false, <span key="b">second</span>, <span key="c">third</span>]}
        />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^My rule/);
    expect(screen.getAllByTestId('rule-meta-item').map((item) => item.textContent)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('renders description between title and meta when provided', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          description={<span>Something went wrong</span>}
          meta={[<span key="a">meta item</span>]}
        />
      </ul>
    );

    const listitem = screen.getByRole('listitem');
    expect(listitem).toHaveTextContent('My rule');
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('meta item')).toBeInTheDocument();
  });

  it('renders nothing for description when absent', () => {
    render(
      <ul>
        <RuleListItem title="My rule" />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('My rule');
  });

  it('renders the right slot when provided', () => {
    render(
      <ul>
        <RuleListItem title="My rule" right={<span>1m</span>} />
      </ul>
    );

    expect(screen.getByText('1m')).toBeInTheDocument();
  });

  it('renders nothing for right when absent', () => {
    render(
      <ul>
        <RuleListItem title="My rule" />
      </ul>
    );

    expect(screen.getByRole('listitem')).not.toHaveTextContent('1m');
  });
});
