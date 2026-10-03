import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { GrafanaRouteError, RELOAD_GUARD_KEY, isRecoverableBuildError, isPluginBuildError } from './GrafanaRouteError';

// An evicted build-addressed plugin asset surfaces to the error boundary as a failed
// dynamic import whose URL is under /public/plugins/. The browser does NOT expose the
// 410 HTTP status on the thrown error, so recovery keys on the error and its URL, not
// on a status field.
function pluginBuildError(): Error {
  const error = new Error('Failed to fetch dynamically imported module: /public/plugins/x/abc123/module.js');
  error.name = 'TypeError';
  return error;
}

// A core Grafana chunk failing to load after an app upgrade: a ChunkLoadError whose
// asset URL is NOT under /public/plugins/.
function coreChunkLoadError(): Error {
  const error = new Error('Loading chunk 123 failed. (error: http://localhost/public/build/123.abcdef.js)');
  error.name = 'ChunkLoadError';
  return error;
}

function genericError(): Error {
  return new Error('Something unrelated blew up');
}

// importPluginModule wraps a SystemJS failure as `Could not load plugin` with the real
// error on `cause`; recovery must still trigger via the cause chain.
function wrappedPluginBuildError(): Error {
  return new Error('Could not load plugin', { cause: pluginBuildError() });
}

// SystemJS.import surfaces a 410 on a pinned build asset as "410 Gone, loading <url>".
function systemjsGoneError(): Error {
  return new Error('410 Gone, loading http://localhost/public/plugins/x/abc123/module.js');
}

describe('GrafanaRouteError', () => {
  const originalLocation = window.location;
  let reloadMock: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    reloadMock = jest.fn();
    // window.location is not writable by default; redefine it so reload() is observable
    // and href assignment does not navigate the jsdom environment.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadMock, href: 'http://localhost/', search: '' },
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    jest.restoreAllMocks();
  });

  describe('isRecoverableBuildError', () => {
    it('treats a failed plugin module import as recoverable (no HTTP status needed)', () => {
      expect(isRecoverableBuildError(pluginBuildError())).toBe(true);
    });

    it('treats a ChunkLoadError as recoverable', () => {
      expect(isRecoverableBuildError(coreChunkLoadError())).toBe(true);
    });

    it('does not treat an unrelated error as recoverable', () => {
      expect(isRecoverableBuildError(genericError())).toBe(false);
    });

    it('does not treat null as recoverable', () => {
      expect(isRecoverableBuildError(null)).toBe(false);
    });

    it('unwraps a wrapped "Could not load plugin" error via the cause chain', () => {
      expect(isRecoverableBuildError(wrappedPluginBuildError())).toBe(true);
    });

    it('treats a SystemJS "410 Gone, loading ..." import failure as recoverable', () => {
      expect(isRecoverableBuildError(systemjsGoneError())).toBe(true);
    });
  });

  describe('isPluginBuildError', () => {
    it('attributes an error referencing a /public/plugins/ asset to a plugin', () => {
      expect(isPluginBuildError(pluginBuildError())).toBe(true);
    });

    it('attributes a wrapped plugin-load error to a plugin via the cause chain', () => {
      expect(isPluginBuildError(wrappedPluginBuildError())).toBe(true);
    });

    it('does not attribute a core chunk error to a plugin', () => {
      expect(isPluginBuildError(coreChunkLoadError())).toBe(false);
    });
  });

  it('triggers plugin recovery for a wrapped "Could not load plugin" error', async () => {
    render(<GrafanaRouteError error={wrappedPluginBuildError()} errorInfo={null} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This plugin has been updated')).toBeInTheDocument();
  });

  it('triggers plugin recovery for a SystemJS "410 Gone" import failure', async () => {
    render(<GrafanaRouteError error={systemjsGoneError()} errorInfo={null} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This plugin has been updated')).toBeInTheDocument();
  });

  it('shows the recovery guard warn modal when a plugin build-evicted error occurs', async () => {
    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);

    // Warn-first: a modal precedes any reload (FR-010, no silent work loss).
    const dialog = await screen.findByRole('dialog');
    // Truthful copy: references the plugin build recovery i18n keys (FR-009).
    expect(within(dialog).getByText('This plugin has been updated')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'The version of this plugin you were using is no longer available because it was updated or removed. Reloading will load the current version.'
      )
    ).toBeInTheDocument();
    // No automatic reload happened before the user confirmed.
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('does not show the misattributing legacy copy in the recovery modal', async () => {
    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);

    await screen.findByRole('dialog');
    expect(screen.queryByText(/Grafana has likely been updated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/private window/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clear.*cache/i)).not.toBeInTheDocument();
  });

  it('reloads once and sets the session guard when the user confirms "Reload now"', async () => {
    const user = userEvent.setup();
    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);

    await screen.findByRole('dialog');
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reload now' }));

    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).not.toBeNull();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('is session-scoped: when the guard is already set it does not show the modal and does not reload (no loop)', async () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');

    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);

    // No warn modal and no reload — recovery fires at most once per session (FR-010).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
    // A manual recovery affordance is still offered.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('does not reload after dismissing with "Not now" and still offers a manual reload', async () => {
    const user = userEvent.setup();
    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('shows core "Grafana has likely been updated" copy for a core chunk error, not plugin copy', async () => {
    render(<GrafanaRouteError error={coreChunkLoadError()} errorInfo={null} />);

    const dialog = await screen.findByRole('dialog');
    // Regression: a core chunk failure must not be mislabeled as a plugin update.
    expect(within(dialog).getByText(/Grafana has likely been updated/i)).toBeInTheDocument();
    expect(within(dialog).queryByText('This plugin has been updated')).not.toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('renders the recovery UI without crashing when sessionStorage is blocked', async () => {
    // Private mode / disabled storage / sandboxed iframe: sessionStorage throws. Scope
    // the throw to our guard key so the test harness's own storage use is unaffected.
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const insecure = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(function (this: Storage, key: string) {
        return key === RELOAD_GUARD_KEY ? insecure() : originalGetItem.call(this, key);
      });
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === RELOAD_GUARD_KEY) {
          insecure();
        }
        originalSetItem.call(this, key, value);
      });

    // Must not throw during render, and the reload prompt must still appear.
    render(<GrafanaRouteError error={pluginBuildError()} errorInfo={null} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('does not trigger recovery for a non-recoverable error', async () => {
    render(<GrafanaRouteError error={genericError()} errorInfo={null} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(await screen.findByText('An unexpected error happened')).toBeInTheDocument();
  });
});
