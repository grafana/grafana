import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../tests/provider';
import {
  ListRoutingTreeApiResponseFactory,
  RoutingTreeFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/Routes';
import {
  ListTimeIntervalApiResponseFactory,
  TimeIntervalFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listRoutingTreeHandler } from '../../api/notifications/v1beta1/mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler';
import { listTimeIntervalHandler } from '../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';
import { USER_DEFINED_TREE_NAME } from '../../notificationPolicies/routingTree.utils';
import { TIMING_DEFAULTS } from '../constants';
import {
  contactPointsErrorScenario,
  contactPointsListScenario,
  emptyTimeIntervalsScenario,
  routingTreesListScenario,
  slackOncallContactPoint,
} from '../notificationSettings.scenario';
import { type ContactPointRoutingSettings } from '../notificationSettingsValue';

import { type ContactPointSettingsStateOptions, useContactPointSettingsState } from './useContactPointSettingsState';

const server = setupMockServer();

const receiver: ContactPointRoutingSettings = { type: 'SimplifiedRouting', receiver: 'slack-oncall' };

beforeEach(() => {
  server.use(...contactPointsListScenario, ...routingTreesListScenario, ...emptyTimeIntervalsScenario);
});

function renderState(options: Partial<ContactPointSettingsStateOptions> = {}) {
  return renderHook(() => useContactPointSettingsState({ value: receiver, ...options }), {
    wrapper: getDefaultWrapper(),
  });
}

function useIntervals(...items: Array<ReturnType<typeof TimeIntervalFactory.build>>) {
  server.use(listTimeIntervalHandler(ListTimeIntervalApiResponseFactory.build({ items })));
}

describe('receiver', () => {
  it('resolves a saved receiver to the selector value and is valid', async () => {
    const { result } = renderState();

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.selectorValue).toBe(
      slackOncallContactPoint.metadata.uid ?? slackOncallContactPoint.spec.title
    );
    expect(result.current.isReceiverUnavailable).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('is valid while the saved receiver is still being looked up', async () => {
    const { result } = renderState();

    expect(result.current).toMatchObject({ status: 'resolving', isValid: true });
    await waitFor(() => expect(result.current.status).toBe('found'));
  });

  it('reports a failed contact point lookup through the status and stays valid', async () => {
    server.use(...contactPointsErrorScenario);
    const { result } = renderState();

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.isValid).toBe(true);
  });

  it('does not depend on the contact point list when no receiver is set and an empty one is allowed', async () => {
    server.use(...contactPointsErrorScenario);
    const { result } = renderState({ value: null, allowEmpty: true });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.isValid).toBe(true);
  });

  it('is invalid without a receiver, unless an empty one is allowed', async () => {
    const { result: strictResult } = renderState({ value: null });
    const { result: lenientResult } = renderState({ value: null, allowEmpty: true });

    await waitFor(() => expect(strictResult.current.status).toBe('unset'));
    expect(strictResult.current.isValid).toBe(false);
    expect(lenientResult.current.isValid).toBe(true);
  });

  it('is invalid when the receiver no longer exists', async () => {
    const { result } = renderState({ value: { ...receiver, receiver: 'gone' } });

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.isReceiverUnavailable).toBe(true);
    expect(result.current.isValid).toBe(false);
  });

  it('stays invalid for a missing receiver even when empty is allowed', async () => {
    const { result } = renderState({ value: { ...receiver, receiver: 'gone' }, allowEmpty: true });

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.isValid).toBe(false);
  });
});

describe('time intervals', () => {
  it.each(['muteTimeIntervals', 'activeTimeIntervals'] as const)(
    'lists a selected %s that cannot be used and is invalid',
    async (field) => {
      useIntervals(
        TimeIntervalFactory.build({
          spec: { name: 'imported' },
          metadata: { annotations: { 'grafana.com/canUse': 'false' } },
        })
      );
      const { result } = renderState({ value: { ...receiver, [field]: ['imported'] } });

      await waitFor(() => expect(result.current.unavailableTimeIntervals).toEqual(['imported']));
      expect(result.current.isValid).toBe(false);
    }
  );

  it('lists a selected interval that no longer exists', async () => {
    const { result } = renderState({ value: { ...receiver, muteTimeIntervals: ['deleted'] } });

    await waitFor(() => expect(result.current.unavailableTimeIntervals).toEqual(['deleted']));
  });

  it('is valid when every selected interval is usable, and lists each name once', async () => {
    useIntervals(TimeIntervalFactory.build({ spec: { name: 'weekends' } }));
    const { result } = renderState({
      value: { ...receiver, muteTimeIntervals: ['weekends'], activeTimeIntervals: ['weekends'] },
    });

    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));
    expect(result.current.unavailableTimeIntervals).toEqual([]);
    expect(result.current.isValid).toBe(true);
  });

  it('is invalid, without listing any as unavailable, while selected intervals load', async () => {
    useIntervals(TimeIntervalFactory.build({ spec: { name: 'weekends' } }));
    const { result } = renderState({ value: { ...receiver, muteTimeIntervals: ['weekends'] } });

    expect(result.current.isLoadingTimeIntervals).toBe(true);
    expect(result.current.unavailableTimeIntervals).toEqual([]);
    expect(result.current.isValid).toBe(false);
    await waitFor(() => expect(result.current.isValid).toBe(true));
  });

  it('is invalid, without listing any as unavailable, when the intervals fail to load', async () => {
    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const { result } = renderState({ value: { ...receiver, muteTimeIntervals: ['weekends'] } });

    await waitFor(() => expect(result.current.isTimeIntervalsError).toBe(true));
    expect(result.current.unavailableTimeIntervals).toEqual([]);
    expect(result.current.isValid).toBe(false);
  });

  it('does not need the interval list when none are selected', async () => {
    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const { result } = renderState();

    await waitFor(() => expect(result.current.isTimeIntervalsError).toBe(true));
    expect(result.current.isValid).toBe(true);
  });
});

describe('timings', () => {
  it('reports every timing the backend would reject, with its reason', async () => {
    const { result } = renderState({
      value: { ...receiver, groupWait: '10ms', groupInterval: '0', repeatInterval: '4h' },
    });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.timingErrors).toEqual({ groupWait: 'format', groupInterval: 'zero' });
    expect(result.current.isValid).toBe(false);
  });

  it('accepts a zero group wait', async () => {
    const { result } = renderState({ value: { ...receiver, groupWait: '0' } });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.timingErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('inherits unset timings from the default policy, falling back to the built-in defaults while it loads', async () => {
    server.use(
      listRoutingTreeHandler(
        ListRoutingTreeApiResponseFactory.build({
          items: [
            RoutingTreeFactory.build({
              metadata: { name: USER_DEFINED_TREE_NAME },
              spec: { defaults: { group_wait: '45s' } },
            }),
          ],
        })
      )
    );
    const { result } = renderState();

    expect(result.current.inheritedTimings).toEqual(TIMING_DEFAULTS);
    await waitFor(() => expect(result.current.inheritedTimings.groupWait).toBe('45s'));
    expect(result.current.inheritedTimings.groupInterval).toBe(TIMING_DEFAULTS.groupInterval);
  });
});

describe('hideRoutingOptions', () => {
  it('ignores timings and intervals that are no longer shown', async () => {
    const { result } = renderState({
      value: { ...receiver, groupWait: '10ms', muteTimeIntervals: ['deleted'] },
      hideRoutingOptions: true,
    });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.isValid).toBe(true);
  });

  it('makes no time interval request and reports none as unavailable', async () => {
    const requested = jest.fn();
    server.use(
      listTimeIntervalHandler(() => {
        requested();
        return HttpResponse.json(ListTimeIntervalApiResponseFactory.build({ items: [] }));
      })
    );
    const { result } = renderState({
      value: { ...receiver, muteTimeIntervals: ['deleted'] },
      hideRoutingOptions: true,
    });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(requested).not.toHaveBeenCalled();
    expect(result.current.unavailableTimeIntervals).toEqual([]);
  });

  it('still requires a usable receiver', async () => {
    const { result } = renderState({ value: { ...receiver, receiver: 'gone' }, hideRoutingOptions: true });

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.isValid).toBe(false);
  });
});
