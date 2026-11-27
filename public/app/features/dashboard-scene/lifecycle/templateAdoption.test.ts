import { act, renderHook } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';

import {
  coversDashboard,
  endTemplateAdoption,
  getTemplateAdoption,
  startTemplateAdoption,
  TEMPLATE_ADOPTION_EXTENSION_POINT,
  TEMPLATE_ADOPTION_TIMEOUT_MS,
  type TemplateAdopter,
  useTemplateAdoption,
} from './templateAdoption';

jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));

function registerAdopters(...adopters: TemplateAdopter[]) {
  jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
  jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
    addedFunctionsRegistry: {
      getState: async () => ({ [TEMPLATE_ADOPTION_EXTENSION_POINT]: adopters.map((fn) => ({ fn })) }),
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
}

/** Lets the adopters answer, or run out of time to: `ms` short of the adoption's own timeout. */
async function settle(ms = 10) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  setTestFlags({ 'assistant.dashboard.artifacts': true });
  locationService.push('/dashboard/new');
});

afterEach(() => {
  endTemplateAdoption();
  setTestFlags({});
  jest.useRealTimers();
});

describe('template adoption', () => {
  it('covers nothing while Grafana previews no plugin-provided pending changes', () => {
    setTestFlags({});
    registerAdopters(() => true);

    expect(startTemplateAdoption()).toBeUndefined();
    expect(getExtensionPointPluginDependencies).not.toHaveBeenCalled();
  });

  it('stays while a plugin adopts the template, through its page and the draft page it moves to', async () => {
    registerAdopters(() => true);

    const adoption = startTemplateAdoption();
    locationService.push('/dashboard/template?gnetId=24372');
    await settle();
    expect(getTemplateAdoption()).toBe(adoption);

    locationService.replace('/d/new-uid?pendingChanges=chat-1');
    expect(getTemplateAdoption()).toBe(adoption);
  });

  it('ends before the template shows when no plugin adopts it', async () => {
    jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue([]);

    startTemplateAdoption();
    await settle();

    expect(getTemplateAdoption()).toBeUndefined();
  });

  it('ends when the plugin answers no, throws, or never answers', async () => {
    for (const adopter of [
      () => false,
      () => Promise.reject(new Error('down')),
      () => new Promise<boolean>(() => {}),
    ]) {
      registerAdopters(adopter);
      startTemplateAdoption();
      await settle(1_000);
      expect(getTemplateAdoption()).toBeUndefined();
    }
  });

  it('ends once the plugin reports the adoption over', async () => {
    let onSettled = () => {};
    registerAdopters((request) => {
      onSettled = request.onSettled;
      return true;
    });

    startTemplateAdoption();
    locationService.push('/dashboard/template?gnetId=24372');
    await settle();
    expect(getTemplateAdoption()).toBeDefined();

    act(() => onSettled());
    expect(getTemplateAdoption()).toBeUndefined();
  });

  it('ends when the user leaves for any other page', async () => {
    registerAdopters(() => true);

    startTemplateAdoption();
    locationService.push('/dashboard/template?gnetId=24372');
    await settle();
    locationService.push('/dashboard/new');

    expect(getTemplateAdoption()).toBeUndefined();
  });

  it('ends after the timeout', async () => {
    registerAdopters(() => true);

    startTemplateAdoption();
    locationService.push('/dashboard/template?gnetId=24372');
    await settle();
    act(() => {
      jest.advanceTimersByTime(TEMPLATE_ADOPTION_TIMEOUT_MS);
    });

    expect(getTemplateAdoption()).toBeUndefined();
  });

  it('leaves a newer adoption to an end meant for an earlier one', () => {
    registerAdopters(() => true);

    const first = startTemplateAdoption();
    const second = startTemplateAdoption();
    endTemplateAdoption(first);

    expect(getTemplateAdoption()).toBe(second);
  });

  it('tells subscribers when it starts and ends', () => {
    registerAdopters(() => true);
    const { result } = renderHook(() => useTemplateAdoption());

    let adoption: ReturnType<typeof startTemplateAdoption>;
    act(() => {
      adoption = startTemplateAdoption();
    });
    expect(result.current).toBe(adoption!);

    act(() => endTemplateAdoption());
    expect(result.current).toBeUndefined();
  });

  it('covers the page’s dashboards except the draft and embedded ones', () => {
    registerAdopters(() => true);
    expect(coversDashboard({ meta: {} })).toBe(false);

    startTemplateAdoption();

    expect(coversDashboard({ meta: {} })).toBe(true);
    expect(coversDashboard({ meta: { newDashboardUid: 'new-uid' } })).toBe(false);
    expect(coversDashboard({ meta: { isEmbedded: true } })).toBe(false);
  });
});
