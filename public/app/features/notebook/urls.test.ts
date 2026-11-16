import { createBrowserHistory, createMemoryHistory } from 'history';

import { HistoryWrapper, config, locationService, setLocationService } from '@grafana/runtime';

import { NOTEBOOK_ENTRY_POINT } from './analytics/types';
import {
  isNotebookEditUrl,
  newNotebookEntryPoint,
  loadSourceForEntryPoint,
  readNotebookLoadSource,
  removeNotebookLoadSourceParam,
  notebookViewUrlFrom,
  notebookRenderUrl,
  notebookEditHref,
  notebookEditUrl,
  notebookNewEditHref,
  notebookShareUrl,
  notebookViewHref,
  notebookViewUrl,
  searchWithoutNotebookSource,
} from './urls';

describe('notebook urls', () => {
  const originalLocationService = locationService;
  const originalAppUrl = config.appUrl;

  afterEach(() => {
    setLocationService(originalLocationService);
    config.appUrl = originalAppUrl;
  });

  /** Notebooks are org-scoped, so every browser-facing URL has to carry orgId. */
  function setHistory(orgId: number, basename?: string) {
    let base;
    if (basename) {
      // createBrowserHistory warns unless the document already sits under the basename.
      window.history.replaceState({}, '', `${basename}/`);
      base = createBrowserHistory({ basename });
    } else {
      base = createMemoryHistory({ initialEntries: ['/'] });
    }
    const wrapper = new HistoryWrapper(base);
    wrapper.setOrgIdGetter(() => orgId);
    setLocationService(wrapper);
  }

  it('keeps the raw route unprefixed, since the router applies the base itself', () => {
    setHistory(1);

    expect(notebookViewUrl('nb1')).toBe('/notebooks/nb1');
  });

  it('carries orgId on the href, so a link opens the org the notebook belongs to', () => {
    setHistory(3);

    expect(notebookViewHref('nb1')).toBe('/notebooks/nb1?orgId=3');
  });

  it('applies the sub-path when Grafana is served under one', () => {
    setHistory(1, '/grafana');

    expect(notebookViewHref('nb1')).toBe('/grafana/notebooks/nb1?orgId=1');
  });

  it('carries both the edit param and orgId, so the list Edit action lands in edit mode', () => {
    setHistory(3);

    expect(notebookEditHref('nb1')).toBe('/notebooks/nb1?edit=true&orgId=3');
  });

  it('opens a new notebook in edit mode in the current org and sub-path', () => {
    setHistory(3, '/grafana');

    expect(notebookNewEditHref()).toBe('/grafana/notebooks/new?edit=true&orgId=3');
  });

  it('carries the launcher source without dropping the org', () => {
    setHistory(3);

    expect(notebookNewEditHref(NOTEBOOK_ENTRY_POINT.COMMAND_PALETTE)).toBe(
      '/notebooks/new?edit=true&notebookSource=command_palette&orgId=3'
    );
  });

  it('reads only supported launcher sources and removes them after creation', () => {
    setHistory(1);
    locationService.push('/notebooks/new?edit=true&notebookSource=quick_add&from=now-3h');

    expect(newNotebookEntryPoint()).toBe(NOTEBOOK_ENTRY_POINT.QUICK_ADD);
    expect(searchWithoutNotebookSource(locationService.getLocation().search)).toBe('?edit=true&from=now-3h&orgId=1');

    locationService.push('/notebooks/new?edit=true&notebookSource=other');
    expect(newNotebookEntryPoint()).toBe(NOTEBOOK_ENTRY_POINT.NOTEBOOK_LIST);
  });

  it('keeps creation attribution separate from existing notebook load attribution', () => {
    setHistory(1);
    locationService.push('/notebooks/new?edit=true&notebookSource=quick_add&source=dashboard_panel');

    expect(newNotebookEntryPoint()).toBe(NOTEBOOK_ENTRY_POINT.QUICK_ADD);
    expect(readNotebookLoadSource()).toBe('dashboard_panel');
    expect(searchWithoutNotebookSource(locationService.getLocation().search)).toBe(
      '?edit=true&source=dashboard_panel&orgId=1'
    );

    removeNotebookLoadSourceParam();
    expect(newNotebookEntryPoint()).toBe(NOTEBOOK_ENTRY_POINT.QUICK_ADD);
    expect(readNotebookLoadSource()).toBe('direct');
  });

  describe('the source a link carries', () => {
    it('adds it to the view and edit links, and to the router-relative one', () => {
      setHistory(3);

      expect(notebookViewHref('nb1', 'explore')).toBe('/notebooks/nb1?source=explore&orgId=3');
      expect(notebookEditHref('nb1', 'notebook_list')).toBe('/notebooks/nb1?edit=true&source=notebook_list&orgId=3');
      expect(notebookViewUrlFrom('nb1', 'notebook_list')).toBe('/notebooks/nb1?source=notebook_list');
    });

    // The share link is copied out of the app. It must not say which surface it was copied from.
    it('leaves it off the share url, and off a link whose source is direct', () => {
      setHistory(3);
      config.appUrl = 'https://grafana.example.com/';

      expect(notebookShareUrl('nb1')).toBe('https://grafana.example.com/notebooks/nb1?orgId=3');
      expect(notebookViewHref('nb1', 'direct')).toBe('/notebooks/nb1?orgId=3');
      expect(notebookViewUrlFrom('nb1', 'direct')).toBe('/notebooks/nb1');
    });

    it('reads a known source off the url', () => {
      setHistory(1);
      locationService.push('/notebooks/nb1?source=dashboard_panel');

      expect(readNotebookLoadSource()).toBe('dashboard_panel');
    });

    // The param is the user's to edit, and what it holds ends up on an analytics event.
    it.each(['', '?source=', '?source=%3Cscript%3E', '?source=assistant', '?other=notebook_list'])(
      'reads %p as a direct visit',
      (search) => {
        setHistory(1);
        locationService.push(`/notebooks/nb1${search}`);

        expect(readNotebookLoadSource()).toBe('direct');
      }
    );

    it('takes the param back off the url without touching the rest', () => {
      setHistory(1);
      locationService.push('/notebooks/nb1?edit=true&source=notebook_list');

      removeNotebookLoadSourceParam();

      expect(locationService.getLocation().search).toContain('edit=true');
      expect(locationService.getLocation().search).not.toContain('source');
    });

    it('maps each entry point to the source its link would carry', () => {
      expect(loadSourceForEntryPoint('explore')).toBe('explore');
      expect(loadSourceForEntryPoint('dashboard_panel')).toBe('dashboard_panel');
      expect(loadSourceForEntryPoint('plugin')).toBe('plugin');
      expect(loadSourceForEntryPoint('notebook_list')).toBe('notebook_list');
      expect(loadSourceForEntryPoint('assistant')).toBe('direct');
      expect(loadSourceForEntryPoint('workspace')).toBe('direct');
    });
  });

  // Router-relative, unlike notebookEditHref: useNavigate applies the base and orgId itself, so
  // prefixing here would double them the same way notebookViewUrl avoids it.
  it('keeps the edit-mode route unprefixed, for router-based navigation', () => {
    setHistory(1);

    expect(notebookEditUrl('nb1')).toBe('/notebooks/nb1?edit=true');
  });

  // Exactly 'true'. A link with any other value opens the notebook as a read.
  it.each([
    ['?edit=true', true],
    ['?edit=false', false],
    ['?edit=1', false],
    ['', false],
  ])('reads "%s" as edit mode %s', (search, expected) => {
    setHistory(1);
    locationService.push(`/notebooks/nb1${search}`);

    expect(isNotebookEditUrl()).toBe(expected);
  });

  it('nests the render route under the notebook it renders', () => {
    setHistory(1);

    expect(notebookRenderUrl('nb1')).toBe('/notebooks/nb1/render');
    expect(notebookRenderUrl('nb1').startsWith(`${notebookViewUrl('nb1')}/`)).toBe(true);
  });

  it('builds an absolute share url', () => {
    setHistory(3);
    config.appUrl = 'https://host/';

    expect(notebookShareUrl('nb1')).toBe('https://host/notebooks/nb1?orgId=3');
  });

  it('builds an absolute share url under a sub-path, keeping it exactly once', () => {
    setHistory(3, '/grafana');
    config.appUrl = 'https://host/grafana/';

    expect(notebookShareUrl('nb1')).toBe('https://host/grafana/notebooks/nb1?orgId=3');
  });
});
