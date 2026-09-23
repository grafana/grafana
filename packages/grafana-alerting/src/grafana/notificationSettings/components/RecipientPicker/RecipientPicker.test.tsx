import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';

import { RecipientPicker, asNamedRoutingTree, asSimplifiedRouting } from './RecipientPicker';
import {
  contactPointsErrorScenario,
  contactPointsListScenario,
  deploymentToolsRoutingTree,
  emptyTimeIntervalsScenario,
  routingTreesErrorScenario,
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

  it('shows an error state instead of silently defaulting when routing trees fail to load', async () => {
    server.use(...routingTreesErrorScenario);

    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    expect(await screen.findByText(/could not load notification policies/i)).toBeInTheDocument();
    expect(screen.queryByText(/default policy/i)).not.toBeInTheDocument();
  });

  it('does not show "Default policy" for a named tree while routing trees are still loading', () => {
    // Assert synchronously, right after render and before MSW has resolved anything - this is
    // exactly the in-flight state useListRoutingTrees() is in immediately after mount.
    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    expect(screen.queryByText(/default policy/i)).not.toBeInTheDocument();
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

describe('onValidityChange', () => {
  it('reports false on mount in contactPoint mode with no receiver, then true once one is set', async () => {
    const onValidityChange = jest.fn();
    const { renderResult } = renderPicker({ onValidityChange });

    expect(onValidityChange).toHaveBeenCalledWith(false);

    renderResult.rerender(
      <RecipientPicker
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
});

describe('asSimplifiedRouting', () => {
  it('returns the value when it has a receiver', () => {
    const value = { type: 'SimplifiedRouting' as const, receiver: 'slack-oncall' };
    expect(asSimplifiedRouting(value)).toBe(value);
  });

  it('returns null for a named-routing-tree value', () => {
    expect(asSimplifiedRouting({ type: 'NamedRoutingTree' as const, routingTree: 'deployment-tools' })).toBeNull();
  });

  it('returns null for null', () => {
    expect(asSimplifiedRouting(null)).toBeNull();
  });
});

describe('asNamedRoutingTree', () => {
  it('returns the value when it has a routingTree', () => {
    const value = { type: 'NamedRoutingTree' as const, routingTree: 'deployment-tools' };
    expect(asNamedRoutingTree(value)).toBe(value);
  });

  it('returns null for a simplified-routing value', () => {
    expect(asNamedRoutingTree({ type: 'SimplifiedRouting' as const, receiver: 'slack-oncall' })).toBeNull();
  });

  it('returns null for null', () => {
    expect(asNamedRoutingTree(null)).toBeNull();
  });
});
