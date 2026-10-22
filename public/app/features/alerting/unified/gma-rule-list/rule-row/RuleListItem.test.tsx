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
});
