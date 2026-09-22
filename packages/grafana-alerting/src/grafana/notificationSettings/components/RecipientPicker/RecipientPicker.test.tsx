import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';

import { RecipientPicker } from './RecipientPicker';
import {
  contactPointsErrorScenario,
  contactPointsListScenario,
  deploymentToolsRoutingTree,
  emptyTimeIntervalsScenario,
  routingTreesListScenario,
  slackOncallContactPoint,
} from './RecipientPicker.scenario';

const server = setupMockServer();

beforeAll(() => {
  mockComboboxRect();
});

beforeEach(() => {
  server.use(...contactPointsListScenario, ...routingTreesListScenario, ...emptyTimeIntervalsScenario);
});

function renderPicker(props: Partial<React.ComponentProps<typeof RecipientPicker>> = {}) {
  return render(<RecipientPicker mode="contactPoint" value={null} onChange={jest.fn()} {...props} />);
}

describe('RecipientPicker', () => {
  it('renders the contact point selector in contactPoint mode', async () => {
    renderPicker();

    expect(screen.getByText(/alertmanager/i)).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: /contact point/i })).toBeInTheDocument();
  });

  it('renders the RoutingTreePicker in notificationPolicy mode', async () => {
    renderPicker({ mode: 'notificationPolicy' });

    expect(await screen.findByText(/default policy/i)).toBeInTheDocument();
  });

  it('writes the selected contact point title (not uid) into receiver on change', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({ onChange });

    const combobox = await screen.findByRole('combobox', { name: /contact point/i });
    await user.click(combobox);
    await user.click(await screen.findByText('slack-oncall'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SimplifiedRouting', receiver: 'slack-oncall' })
    );
  });

  it('resolves an existing receiver title back to the matching contact point for the controlled value', async () => {
    renderPicker({ value: { type: 'SimplifiedRouting', receiver: slackOncallContactPoint.spec.title } });

    expect(await screen.findByDisplayValue('slack-oncall')).toBeInTheDocument();
  });

  it('shows an error state instead of silently defaulting when contact points fail to load', async () => {
    server.use(...contactPointsErrorScenario);

    renderPicker({ value: { type: 'SimplifiedRouting', receiver: 'slack-oncall' } });

    expect(await screen.findByText(/could not load contact points/i)).toBeInTheDocument();
  });

  it('emits a NamedRoutingTree on selecting a policy', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({ mode: 'notificationPolicy', onChange });

    await user.click(await screen.findByRole('button', { name: /change notification policy/i }));
    await user.click(await screen.findByRole('combobox', { name: /select notification policy/i }));
    await user.click(await screen.findByRole('option', { name: /deployment-tools/i }));

    expect(onChange).toHaveBeenCalledWith({
      type: 'NamedRoutingTree',
      routingTree: deploymentToolsRoutingTree.metadata.name,
    });
  });

  it('emits null when resetting an existing named policy back to default', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({
      mode: 'notificationPolicy',
      value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' },
      onChange,
    });

    await user.click(await screen.findByRole('button', { name: /reset to default policy/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
