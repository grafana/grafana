import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { ChainPill } from './ChainPill';

const ui = {
  pill: byRole('button'),
};

describe('ChainPill', () => {
  it('renders chain name and position/total', () => {
    render(
      <ChainPill chainId="usage-chain" chainName="Usage Alerts Chain" position={2} total={4} onClick={jest.fn()} />
    );

    const pill = ui.pill.get();
    expect(pill).toHaveTextContent('Usage Alerts Chain');
    expect(pill).toHaveTextContent('2/4');
    expect(pill).toHaveAccessibleName(/Usage Alerts Chain/);
    expect(pill).toHaveAccessibleName(/2/);
    expect(pill).toHaveAccessibleName(/4/);
  });

  it('calls onClick with chain id and position when clicked', async () => {
    const onClick = jest.fn();
    const { user } = render(
      <ChainPill chainId="usage-chain" chainName="Usage Alerts Chain" position={3} total={4} onClick={onClick} />
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('usage-chain', 3);
  });
});
