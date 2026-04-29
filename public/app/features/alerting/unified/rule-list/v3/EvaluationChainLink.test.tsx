import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { EvaluationChainLink } from './EvaluationChainLink';

const ui = {
  link: byRole('button'),
};

describe('EvaluationChainLink', () => {
  it('renders the fixed evaluation chain text and includes position info in the accessible label', () => {
    render(<EvaluationChainLink chainId="usage-chain" position={2} total={4} onClick={jest.fn()} />);

    const link = ui.link.get();
    expect(link).toHaveTextContent('Evaluation chain');
    expect(link).toHaveAccessibleName(/Evaluation chain/i);
    expect(link).toHaveAccessibleName(/2/);
    expect(link).toHaveAccessibleName(/4/);
  });

  it('calls onClick with chain id and position when clicked', async () => {
    const onClick = jest.fn();
    const { user } = render(<EvaluationChainLink chainId="usage-chain" position={3} total={4} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('usage-chain', 3);
  });
});
