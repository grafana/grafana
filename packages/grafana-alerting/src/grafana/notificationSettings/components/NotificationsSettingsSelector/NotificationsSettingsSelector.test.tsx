import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Routes';
import { listRoutingTreeHandler } from '../../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { USER_DEFINED_TREE_NAME } from '../../../notificationPolicies/routingTree.utils';

import { NotificationsSettingsSelector } from './NotificationsSettingsSelector';
import {
  contactPointsErrorScenario,
  contactPointsListScenario,
  deploymentToolsRoutingTree,
  emptyTimeIntervalsScenario,
  routingTreesErrorScenario,
  routingTreesListScenario,
  slackOncallContactPoint,
} from './NotificationsSettingsSelector.scenario';

const server = setupMockServer();

beforeAll(() => {
  mockComboboxRect();
});

beforeEach(() => {
  server.use(...contactPointsListScenario, ...routingTreesListScenario, ...emptyTimeIntervalsScenario);
});

function renderPicker(props: Partial<React.ComponentProps<typeof NotificationsSettingsSelector>> = {}) {
  return render(<NotificationsSettingsSelector mode="contactPoint" value={null} onChange={jest.fn()} {...props} />);
}

describe('NotificationsSettingsSelector', () => {
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

  it('shows an error state instead of silently defaulting when routing trees fail to load', async () => {
    server.use(...routingTreesErrorScenario);

    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    expect(await screen.findByText(/could not load notification policies/i)).toBeInTheDocument();
    expect(screen.queryByText(/default policy/i)).not.toBeInTheDocument();
  });

  it('does not show "Default policy" for a named tree while routing trees are still loading', () => {
    // Assert synchronously, right after render and before MSW has resolved anything - this is
    // exactly the in-flight state useRoutingTrees() is in immediately after mount.
    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    expect(screen.queryByText(/default policy/i)).not.toBeInTheDocument();
  });

  it('warns instead of silently defaulting when the referenced routing tree no longer exists', async () => {
    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deleted-tree' } });

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
    expect(screen.getByText(/default policy/i)).toBeInTheDocument();
  });

  it('does not preview the default policy for a routing tree that no longer exists', async () => {
    renderPicker({
      mode: 'notificationPolicy',
      value: { type: 'NamedRoutingTree', routingTree: 'deleted-tree' },
      instancesToPreview: [[['severity', 'critical']]],
    });

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
    expect(screen.queryByText('Who would get notified')).not.toBeInTheDocument();
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

describe('a saved receiver that no longer exists', () => {
  const missing = { type: 'SimplifiedRouting' as const, receiver: 'deleted-contact-point' };

  it('warns instead of silently looking unselected, and disables the section', async () => {
    const { user } = renderPicker({ value: missing });

    expect(await screen.findByText(/contact point could not be found/i)).toBeInTheDocument();

    await user.click(screen.getByText(/muting, grouping and timings/i));
    expect(screen.getByRole('switch', { name: /override grouping/i })).toBeDisabled();
  });

  it('reports invalid once the contact points have loaded', async () => {
    const onValidityChange = jest.fn();
    renderPicker({ value: missing, onValidityChange });

    await screen.findByText(/contact point could not be found/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('does not warn for an existing receiver', async () => {
    renderPicker({ value: { type: 'SimplifiedRouting', receiver: 'slack-oncall' } });

    await screen.findByRole('combobox', { name: /contact point/i });

    expect(screen.queryByText(/contact point could not be found/i)).not.toBeInTheDocument();
  });
});

describe('a saved routing tree', () => {
  it('reports invalid once it is confirmed missing', async () => {
    const onValidityChange = jest.fn();
    renderPicker({
      mode: 'notificationPolicy',
      value: { type: 'NamedRoutingTree', routingTree: 'deleted-tree' },
      onValidityChange,
    });

    await screen.findByText(/notification policy could not be found/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('stays valid for the default policy (null) once the trees have loaded', async () => {
    const onValidityChange = jest.fn();
    renderPicker({ mode: 'notificationPolicy', value: null, onValidityChange });

    await screen.findByText(/default policy/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps the default policy valid, without a warning, when the user can read no trees', async () => {
    server.use(listRoutingTreeHandler(ListRoutingTreeApiResponseFactory.build({ items: [] })));
    const onValidityChange = jest.fn();
    renderPicker({ mode: 'notificationPolicy', value: null, onValidityChange });

    await screen.findByText(/default policy/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument();
  });

  it('stays valid for an existing named tree', async () => {
    const onValidityChange = jest.fn();
    renderPicker({
      mode: 'notificationPolicy',
      value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' },
      onValidityChange,
    });

    await screen.findByRole('button', { name: /reset to default policy/i });

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});

describe('cleared timings', () => {
  it('are emitted as undefined, not as empty durations', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({
      onChange,
      value: { type: 'SimplifiedRouting', receiver: 'slack-oncall', groupWait: '1m' },
    });

    await user.clear(await screen.findByLabelText(/^group wait$/i));

    const [emitted] = onChange.mock.calls.at(-1);
    expect(emitted.groupWait).toBeUndefined();
  });
});

describe('onValidityChange', () => {
  it('reports false on mount in contactPoint mode with no receiver, then true once one is set', async () => {
    const onValidityChange = jest.fn();
    const { renderResult } = renderPicker({ onValidityChange });

    expect(onValidityChange).toHaveBeenCalledWith(false);

    renderResult.rerender(
      <NotificationsSettingsSelector
        mode="contactPoint"
        value={{ type: 'SimplifiedRouting', receiver: 'slack-oncall' }}
        onChange={jest.fn()}
        onValidityChange={onValidityChange}
      />
    );

    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it('reports true in notificationPolicy mode regardless of value', () => {
    const onValidityChange = jest.fn();
    renderPicker({ mode: 'notificationPolicy', onValidityChange });

    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it('reports false when a group or repeat interval is zero', () => {
    const onValidityChange = jest.fn();
    renderPicker({
      onValidityChange,
      value: { type: 'SimplifiedRouting', receiver: 'slack-oncall', groupInterval: '0s' },
    });

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('reports false for a malformed duration', () => {
    const onValidityChange = jest.fn();
    renderPicker({
      onValidityChange,
      value: { type: 'SimplifiedRouting', receiver: 'slack-oncall', groupWait: '20s4h' },
    });

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('allows a zero group wait', () => {
    const onValidityChange = jest.fn();
    renderPicker({
      onValidityChange,
      value: { type: 'SimplifiedRouting', receiver: 'slack-oncall', groupWait: '0s' },
    });

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});

describe('inherited timings', () => {
  it('shows the default policy tree timings as what an unset rule inherits', async () => {
    const defaultTree = RoutingTreeFactory.build({
      metadata: { name: USER_DEFINED_TREE_NAME },
      spec: { defaults: { receiver: 'web-team', group_wait: '1m' } },
    });
    server.use(listRoutingTreeHandler(ListRoutingTreeApiResponseFactory.build({ items: [defaultTree] })));
    const { user } = renderPicker({ value: { type: 'SimplifiedRouting', receiver: 'slack-oncall' } });

    await user.click(screen.getByText(/muting, grouping and timings/i));

    expect(await screen.findByText('1m')).toBeInTheDocument();
  });
});
