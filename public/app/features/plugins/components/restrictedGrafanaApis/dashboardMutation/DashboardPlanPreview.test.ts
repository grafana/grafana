import { locationService } from '@grafana/runtime';
import type { MutationClient, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';

import { DashboardPlanPreview } from './DashboardPlanPreview';

const plan = {
  planId: 'plan-1',
  title: 'Service overview',
  layout: 'rows',
  sections: [{ title: 'Health', panels: [{ title: 'Requests', vizType: 'timeseries' }] }],
};
const success: MutationResult = { success: true, changes: [] };

function createClient() {
  return { execute: jest.fn(async (): Promise<MutationResult> => success), getAvailableCommands: () => [] };
}

describe('DashboardPlanPreview', () => {
  let client: MutationClient | null;
  let preview: DashboardPlanPreview;

  beforeEach(() => {
    jest.useFakeTimers();
    client = null;
    preview = new DashboardPlanPreview(() => client);
    locationService.replace('/explore?orgId=1#origin');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function openPlan() {
    const rendering = preview.render(plan);
    const mounted = createClient();
    client = mounted;
    await jest.advanceTimersByTimeAsync(50);
    expect(await rendering).toEqual(success);
    return mounted;
  }

  it('opens a new dashboard and waits for its client before rendering', async () => {
    const previous = createClient();
    client = previous;
    locationService.replace('/d/existing/saved?orgId=1');

    const rendering = preview.render(plan);
    expect(locationService.getLocation()).toMatchObject({
      pathname: '/dashboard/new',
      search: '?title=Service%20overview&editSource=plan-preview',
    });
    await jest.advanceTimersByTimeAsync(100);
    expect(previous.execute).not.toHaveBeenCalled();

    const mounted = createClient();
    client = mounted;
    await jest.advanceTimersByTimeAsync(50);
    expect(await rendering).toEqual(success);
    expect(mounted.execute).toHaveBeenCalledWith({ type: 'RENDER_PLAN', payload: plan });
  });

  it('reuses an already mounted new dashboard', async () => {
    locationService.replace('/dashboard/new');
    const mounted = createClient();
    client = mounted;

    expect(await preview.render(plan)).toEqual(success);
    expect(mounted.execute).toHaveBeenCalledWith({ type: 'RENDER_PLAN', payload: plan });
  });

  it('returns to the original page including query and hash when dismissed', async () => {
    const mounted = await openPlan();
    await preview.end({ planId: plan.planId, restoreUserLocation: true });

    expect(mounted.execute).toHaveBeenLastCalledWith({
      type: 'END_PLANNING',
      payload: { planId: plan.planId, restoreUserLocation: true },
    });
    expect(locationService.getLocation()).toMatchObject({ pathname: '/explore', search: '?orgId=1', hash: '#origin' });
  });

  it('stays on the dashboard when handing off to a build', async () => {
    await openPlan();
    await preview.end({ planId: plan.planId });

    expect(locationService.getLocation().pathname).toBe('/dashboard/new');
  });

  it('keeps the original return location across revised plans without navigating again', async () => {
    await openPlan();
    const replace = jest.spyOn(locationService, 'replace');
    await preview.render({ ...plan, planId: 'plan-2' });
    expect(replace).not.toHaveBeenCalled();
    expect((await preview.end({ planId: plan.planId, restoreUserLocation: true })).success).toBe(false);
    await preview.end({ planId: 'plan-2', restoreUserLocation: true });
    expect(replace).toHaveBeenCalledWith('/explore?orgId=1#origin');
  });

  it('keeps the original location when replaced before the dashboard mounts', async () => {
    const first = preview.render(plan);
    const second = preview.render({ ...plan, planId: 'plan-2' });
    const mounted = createClient();
    client = mounted;
    await jest.advanceTimersByTimeAsync(50);

    expect((await first).success).toBe(false);
    expect(await second).toEqual(success);
    expect(mounted.execute).toHaveBeenCalledTimes(1);
    await preview.end({ planId: 'plan-2', restoreUserLocation: true });
    expect(locationService.getLocation().pathname).toBe('/explore');
  });

  it('validates the plan before navigating', async () => {
    const replace = jest.spyOn(locationService, 'replace');
    expect((await preview.render({ title: 'Missing plan' })).success).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(['refused', 'rejected'])('restores the original page when rendering is %s', async (failure) => {
    const rendering = preview.render(plan);
    const mounted = createClient();
    if (failure === 'refused') {
      mounted.execute.mockResolvedValueOnce({ success: false, error: 'Cannot preview', changes: [] });
    } else {
      mounted.execute.mockRejectedValueOnce(new Error('Cannot preview'));
    }
    client = mounted;
    await jest.advanceTimersByTimeAsync(50);

    expect(await rendering).toMatchObject({ success: false, error: 'Cannot preview' });
    expect(locationService.getLocation().pathname).toBe('/explore');
  });

  it('restores the original page if the dashboard never mounts', async () => {
    const rendering = preview.render(plan);
    await jest.advanceTimersByTimeAsync(10000);

    expect(await rendering).toMatchObject({ success: false, error: expect.stringContaining('Timed out') });
    expect(locationService.getLocation().pathname).toBe('/explore');
  });

  it('does not override manual navigation while waiting for the dashboard', async () => {
    const rendering = preview.render(plan);
    locationService.replace('/dashboards');
    await jest.advanceTimersByTimeAsync(50);

    expect((await rendering).success).toBe(false);
    expect(locationService.getLocation().pathname).toBe('/dashboards');
  });

  it('does not restore an older preview over a newer one after a late failure', async () => {
    const mounted = await openPlan();
    let fail!: (result: MutationResult) => void;
    mounted.execute.mockImplementationOnce(() => new Promise((resolve) => (fail = resolve)));
    const older = preview.render({ ...plan, planId: 'plan-2' });
    await preview.render({ ...plan, planId: 'plan-3' });
    fail({ success: false, changes: [], error: 'Late failure' });
    await older;

    expect(locationService.getLocation().pathname).toBe('/dashboard/new');
    expect((await preview.end({ planId: 'plan-3', restoreUserLocation: true })).success).toBe(true);
    expect(locationService.getLocation().pathname).toBe('/explore');
  });

  it('keeps the return location available after an unsuccessful end so it can be retried', async () => {
    const mounted = await openPlan();
    mounted.execute.mockResolvedValueOnce({ success: false, changes: [], error: 'Could not end preview' });
    expect((await preview.end({ planId: plan.planId, restoreUserLocation: true })).success).toBe(false);
    expect(locationService.getLocation().pathname).toBe('/dashboard/new');

    expect((await preview.end({ planId: plan.planId, restoreUserLocation: true })).success).toBe(true);
    expect(locationService.getLocation().pathname).toBe('/explore');
  });

  it('does not end a preview after its dashboard was replaced', async () => {
    const oldClient = await openPlan();
    oldClient.execute.mockClear();
    const newClient = createClient();
    client = newClient;

    expect((await preview.end({ planId: plan.planId, restoreUserLocation: true })).success).toBe(false);
    expect(newClient.execute).not.toHaveBeenCalled();
    expect(oldClient.execute).not.toHaveBeenCalled();
    expect(locationService.getLocation().pathname).toBe('/dashboard/new');
  });
});
