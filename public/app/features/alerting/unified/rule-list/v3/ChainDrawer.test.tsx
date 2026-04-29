import { render } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setupMswServer } from '../../mockApi';

import { ChainDrawer } from './ChainDrawer';

setupMswServer();

const ui = {
  drawer: byRole('dialog'),
  closeButton: byRole('button', { name: /close/i }),
};

describe('ChainDrawer', () => {
  it('renders chain name, meta values and evaluation order steps', async () => {
    render(<ChainDrawer chainId="usage-chain" currentPosition={2} onClose={jest.fn()} />);

    // Meta row — mode and interval from fixture. Rules count "4" is omitted from
    // assertion here because the step-number circles also contain "4".
    expect(await byText('Sequential').find()).toBeInTheDocument();
    expect(byText('1m').get()).toBeInTheDocument();

    // Each evaluation step title from fixture
    expect(byText('hosted_grafana:pause_events:10m').get()).toBeInTheDocument();
    expect(byText(/namespace=sum_by/).get()).toBeInTheDocument();
    expect(byText(/namespace=AWS\/EC2/).get()).toBeInTheDocument();
    expect(byText(/namespace=prod/).get()).toBeInTheDocument();

    // "You are here" marker rendered for the current (position 2) step
    expect(byText(/you are here/i).get()).toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const { user } = render(<ChainDrawer chainId="usage-chain" currentPosition={1} onClose={onClose} />);

    await ui.drawer.find();
    await user.click(ui.closeButton.get());
    expect(onClose).toHaveBeenCalled();
  });
});
