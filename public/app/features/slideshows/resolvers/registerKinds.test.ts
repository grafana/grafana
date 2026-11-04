import { type AppPluginConfig } from '@grafana/data';
import { getPlaylistItemKind, getPlaylistItemKinds, setBackendSrv, type BackendSrv } from '@grafana/runtime';
import { resetPlaylistItemKindsForTests, setAppPluginMetas } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { registerSlideshowKinds } from './registerKinds';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const assistantApp = { id: 'grafana-assistant-app' } as unknown as AppPluginConfig;

describe('registerSlideshowKinds', () => {
  beforeEach(() => {
    resetPlaylistItemKindsForTests();
  });

  afterEach(() => {
    setAppPluginMetas({});
    setTestFlags({});
  });

  it('registers dashboards', async () => {
    setTestFlags({ 'playlist.slideshows': true });
    await registerSlideshowKinds();

    expect(getPlaylistItemKind('dashboard.grafana.app', 'dashboards')).toBeDefined();
  });

  it('registers nothing while the slideshows toggle is off', async () => {
    setTestFlags({ 'playlist.slideshows': false, 'dashboard.notebooks': true });
    setAppPluginMetas({ 'grafana-assistant-app': assistantApp });
    await registerSlideshowKinds();

    expect(getPlaylistItemKinds()).toEqual([]);
  });

  it('registers pages only when the assistant app is installed', async () => {
    setTestFlags({ 'playlist.slideshows': true });
    setAppPluginMetas({});
    await registerSlideshowKinds();
    expect(getPlaylistItemKind('assistant.ext.grafana.app', 'pages')).toBeUndefined();

    resetPlaylistItemKindsForTests();
    setAppPluginMetas({ 'grafana-assistant-app': assistantApp });
    await registerSlideshowKinds();
    expect(getPlaylistItemKinds().map((k) => k.title)).toContain('Pages');
  });

  it('registers notebooks only when the notebooks toggle is on', async () => {
    setTestFlags({ 'playlist.slideshows': true, 'dashboard.notebooks': false });
    await registerSlideshowKinds();
    expect(getPlaylistItemKind('dashboard.grafana.app', 'notebooks')).toBeUndefined();

    resetPlaylistItemKindsForTests();
    setTestFlags({ 'playlist.slideshows': true, 'dashboard.notebooks': true });
    await registerSlideshowKinds();
    expect(getPlaylistItemKind('dashboard.grafana.app', 'notebooks')).toBeDefined();
  });

  it('opens a page and a notebook at their viewer urls', async () => {
    setAppPluginMetas({ 'grafana-assistant-app': assistantApp });
    setTestFlags({ 'playlist.slideshows': true, 'dashboard.notebooks': true });
    await registerSlideshowKinds();

    const get = jest.fn().mockResolvedValue({ spec: { title: 'T' } });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    setBackendSrv({ get } as unknown as BackendSrv);

    await expect(getPlaylistItemKind('assistant.ext.grafana.app', 'pages')?.resolve('p1')).resolves.toEqual({
      url: '/a/grafana-assistant-app/pages/p1',
      title: 'T',
    });
    await expect(getPlaylistItemKind('dashboard.grafana.app', 'notebooks')?.resolve('n1')).resolves.toEqual({
      url: '/notebooks/n1',
      title: 'T',
    });
    expect(get.mock.calls[0][0]).toContain('/apis/assistant.ext.grafana.app/v0alpha1/');
    expect(get.mock.calls[1][0]).toContain('/apis/dashboard.grafana.app/v2beta1/');
  });
});
