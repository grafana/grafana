import { render, screen } from 'test/test-utils';

import { RuleInstanceCounts } from './RuleInstanceCounts';
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

  it('hides a meta slot whose child renders nothing so no empty bordered gap remains', () => {
    render(
      <ul>
        <RuleListItem
          title="My rule"
          meta={[
            <RuleInstanceCounts key="counts" searchHit={{ uid: 'rule-1', title: 'CPU high' }} />,
            <span key="shown">shown</span>,
          ]}
        />
      </ul>
    );

    expect(screen.getByText('shown')).toBeVisible();
    expect(screen.queryByRole('link', { name: /instances/i })).not.toBeInTheDocument();

    const items = screen.getAllByTestId('rule-meta-item');
    const emptySlot = items.find((item) => item.textContent === '');
    expect(emptySlot).toBeDefined();
    expect(emptySlot).toHaveStyle({ display: 'none' });
    expect(items.find((item) => item.textContent === 'shown')).toBeVisible();
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
