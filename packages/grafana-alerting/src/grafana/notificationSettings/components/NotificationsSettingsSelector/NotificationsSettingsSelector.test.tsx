import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import { HttpResponse } from 'msw';
import { useState } from 'react';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { store } from '../../../../../tests/provider';
import { act, render, screen, waitFor } from '../../../../../tests/test-utils';
import { notificationsAPI } from '../../../api/notifications';
import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Receivers';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Routes';
import {
  ListTimeIntervalApiResponseFactory,
  TimeIntervalFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listReceiverHandler } from '../../../api/notifications/v1beta1/mocks/handlers/ReceiverHandlers/listReceiverHandler';
import { listRoutingTreeHandler } from '../../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { listTimeIntervalHandler } from '../../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';
import { USER_DEFINED_TREE_NAME } from '../../../notificationPolicies/routingTree.utils';
import { type NotificationSettings } from '../../notificationSettingsValue';

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
    expect(screen.getByText('Default policy')).toBeInTheDocument();
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

describe('contact point links', () => {
  afterEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: config.appSubUrl } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
  });

  it.each([
    ['', '/alerting/notifications', '/alerting/notifications'],
    ['/grafana', '/alerting/notifications', '/grafana/alerting/notifications'],
    ['/grafana', '/grafana/alerting/notifications', '/grafana/alerting/notifications'],
    ['/grafana', 'https://example.com/contact-points', 'https://example.com/contact-points'],
  ])('opens %s + %s at %s in a new tab', (appSubUrl, href, expected) => {
    locationUtil.initialize({
      config: { appSubUrl } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
    renderPicker({ manageContactPointsHref: href });

    const link = screen.getByRole('link', { name: /view or create contact points/i });
    expect(link).toHaveAttribute('href', expected);
    expect(link).toHaveAttribute('target', '_blank');
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

describe('a saved receiver that cannot be used', () => {
  const imported = { type: 'SimplifiedRouting' as const, receiver: 'imported-contact-point' };

  beforeEach(() => {
    const unusable = ContactPointFactory.build({
      metadata: { annotations: { 'grafana.com/canUse': 'false' } },
      spec: { title: imported.receiver },
    });
    server.use(
      listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [slackOncallContactPoint, unusable] }))
    );
  });

  it('warns that it cannot be used, and disables the section', async () => {
    const { user } = renderPicker({ value: imported });

    expect(await screen.findByText(/contact point cannot be used/i)).toBeInTheDocument();

    await user.click(screen.getByText(/muting, grouping and timings/i));
    expect(screen.getByRole('switch', { name: /override grouping/i })).toBeDisabled();
  });

  it('reports invalid, like a receiver that no longer exists', async () => {
    const onValidityChange = jest.fn();
    renderPicker({ value: imported, onValidityChange });

    await screen.findByText(/contact point cannot be used/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });
});

describe('a saved routing tree', () => {
  it('lets the user fall back to the default policy when the saved tree is missing', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({
      mode: 'notificationPolicy',
      value: { type: 'NamedRoutingTree', routingTree: 'deleted-tree' },
      onChange,
    });

    await user.click(await screen.findByRole('button', { name: /use the default policy/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not offer the fallback for an existing tree', async () => {
    renderPicker({ mode: 'notificationPolicy', value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    await screen.findByRole('button', { name: /reset to default policy/i });

    expect(screen.queryByRole('button', { name: /use the default policy/i })).not.toBeInTheDocument();
  });

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

describe('selected time intervals', () => {
  const receiver = { type: 'SimplifiedRouting' as const, receiver: 'slack-oncall' };

  it.each(['muteTimeIntervals', 'activeTimeIntervals'] as const)(
    'reports a missing %s as invalid until the reference is removed',
    async (field) => {
      const onValidityChange = jest.fn();
      const onChange = jest.fn();
      const { renderResult } = renderPicker({
        value: { ...receiver, [field]: ['deleted-interval'] },
        onChange,
        onValidityChange,
      });

      await screen.findByDisplayValue('slack-oncall');
      await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Some selected mute or active time intervals no longer exist or cannot be used: deleted-interval'
      );
      expect(onChange).not.toHaveBeenCalled();

      renderResult.rerender(
        <NotificationsSettingsSelector
          mode="contactPoint"
          value={receiver}
          onChange={onChange}
          onValidityChange={onValidityChange}
        />
      );

      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );

  it.each(['muteTimeIntervals', 'activeTimeIntervals'] as const)('reports an unusable %s as invalid', async (field) => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [
            TimeIntervalFactory.build({
              spec: { name: 'imported-interval' },
              metadata: { annotations: { 'grafana.com/canUse': 'false' } },
            }),
          ],
        })
      )
    );
    const onValidityChange = jest.fn();
    renderPicker({ value: { ...receiver, [field]: ['imported-interval'] }, onValidityChange });

    await screen.findByDisplayValue('slack-oncall');
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some selected mute or active time intervals no longer exist or cannot be used: imported-interval'
    );
  });

  it('waits for the interval list before reporting a selected interval as valid', async () => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [TimeIntervalFactory.build({ spec: { name: 'weekends' } })],
        })
      )
    );
    const onValidityChange = jest.fn();
    renderPicker({ value: { ...receiver, muteTimeIntervals: ['weekends'] }, onValidityChange });

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps selected intervals invalid when the initial list request fails', async () => {
    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const onValidityChange = jest.fn();
    renderPicker({ value: { ...receiver, activeTimeIntervals: ['business-hours'] }, onValidityChange });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load mute/active timings');
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('reports invalid when a refetch removes the selected interval', async () => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [TimeIntervalFactory.build({ spec: { name: 'weekends' } })],
        })
      )
    );
    const onValidityChange = jest.fn();
    renderPicker({ value: { ...receiver, muteTimeIntervals: ['weekends'] }, onValidityChange });
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));

    server.use(...emptyTimeIntervalsScenario);
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listTimeInterval.initiate({}, { forceRefetch: true }));
    });

    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
    expect(screen.getByRole('alert')).toHaveTextContent('weekends');
  });

  it('keeps a confirmed interval valid when a later refetch fails', async () => {
    server.use(
      listTimeIntervalHandler(
        ListTimeIntervalApiResponseFactory.build({
          items: [TimeIntervalFactory.build({ spec: { name: 'weekends' } })],
        })
      )
    );
    const onValidityChange = jest.fn();
    renderPicker({ value: { ...receiver, muteTimeIntervals: ['weekends'] }, onValidityChange });
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));

    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listTimeInterval.initiate({}, { forceRefetch: true }));
    });

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

describe('mode toggle', () => {
  it('renders no toggle when the caller controls the mode', async () => {
    renderPicker({ mode: 'contactPoint' });

    await screen.findByRole('combobox', { name: /contact point/i });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('renders the toggle, starting on contact point, when no mode is given', async () => {
    renderPicker({ mode: undefined });

    expect(await screen.findByRole('radio', { name: /contact point/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /notification policy/i })).not.toBeChecked();
  });

  it('starts on notification policy when the value is a named routing tree', async () => {
    renderPicker({ mode: undefined, value: { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } });

    expect(await screen.findByRole('radio', { name: /notification policy/i })).toBeChecked();
  });

  it('follows a named routing tree that arrives after mount', async () => {
    const { renderResult } = renderPicker({ mode: undefined });
    await screen.findByRole('combobox', { name: /contact point/i });

    renderResult.rerender(
      <NotificationsSettingsSelector
        value={{ type: 'NamedRoutingTree', routingTree: 'deployment-tools' }}
        onChange={jest.fn()}
      />
    );

    expect(await screen.findByRole('radio', { name: /notification policy/i })).toBeChecked();
    expect(await screen.findByRole('button', { name: /reset to default policy/i })).toBeInTheDocument();
  });

  it.each([false, true])(
    'keeps notification policy mode when resetting a named tree to default (loaded after mount: %p)',
    async (loadAfterMount) => {
      const namedTree: NotificationSettings = { type: 'NamedRoutingTree', routingTree: 'deployment-tools' };
      const onChange = jest.fn();
      const onModeChange = jest.fn();
      const onValidityChange = jest.fn();

      function Parent() {
        const [value, setValue] = useState<NotificationSettings | null>(loadAfterMount ? null : namedTree);
        return (
          <>
            {loadAfterMount && <button onClick={() => setValue(namedTree)}>Load rule</button>}
            <NotificationsSettingsSelector
              value={value}
              onChange={(next) => {
                setValue(next);
                onChange(next);
              }}
              onModeChange={onModeChange}
              onValidityChange={onValidityChange}
            />
          </>
        );
      }

      const { user } = render(<Parent />);
      if (loadAfterMount) {
        await user.click(screen.getByRole('button', { name: 'Load rule' }));
      }
      expect(screen.getByRole('radio', { name: 'Notification policy' })).toBeChecked();

      await user.click(await screen.findByRole('button', { name: /reset to default policy/i }));

      expect(onChange).toHaveBeenLastCalledWith(null);
      expect(screen.getByRole('radio', { name: 'Notification policy' })).toBeChecked();
      expect(await screen.findByText('Default policy')).toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(onModeChange).not.toHaveBeenCalled();
    }
  );

  it('switches mode, clears the value and reports the new mode', async () => {
    const onChange = jest.fn();
    const onModeChange = jest.fn();
    function Parent() {
      const [value, setValue] = useState<NotificationSettings | null>({
        type: 'SimplifiedRouting',
        receiver: 'slack-oncall',
      });
      return (
        <NotificationsSettingsSelector
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          onModeChange={onModeChange}
        />
      );
    }
    const { user } = render(<Parent />);

    await user.click(await screen.findByRole('radio', { name: /notification policy/i }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onModeChange).toHaveBeenCalledWith('notificationPolicy');
    expect(await screen.findByText(/default policy/i)).toBeInTheDocument();
  });

  it('does not clear the value when the active mode is clicked again', async () => {
    const onChange = jest.fn();
    const { user } = renderPicker({ mode: undefined, onChange });

    await user.click(await screen.findByRole('radio', { name: /contact point/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('allowEmpty', () => {
  it('reports valid with no contact point picked', () => {
    const onValidityChange = jest.fn();
    renderPicker({ allowEmpty: true, onValidityChange });

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('still reports invalid for a saved contact point that no longer exists', async () => {
    const onValidityChange = jest.fn();
    renderPicker({
      allowEmpty: true,
      value: { type: 'SimplifiedRouting', receiver: 'deleted-contact-point' },
      onValidityChange,
    });

    await screen.findByText(/contact point could not be found/i);

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('still reports invalid for bad timings', () => {
    const onValidityChange = jest.fn();
    renderPicker({
      allowEmpty: true,
      value: { type: 'SimplifiedRouting', receiver: 'slack-oncall', groupWait: '20s4h' },
      onValidityChange,
    });

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });
});
