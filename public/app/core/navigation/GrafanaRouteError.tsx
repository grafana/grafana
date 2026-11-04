import { css } from '@emotion/css';
import { type ErrorInfo, useState } from 'react';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, ErrorWithStack, useStyles2 } from '@grafana/ui';

import { Page } from '../components/Page/Page';

interface Props {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Session-scoped guard so recovery from an evicted plugin build fires at most once
 * per browser session — prevents a reload loop when the current build is also broken.
 */
export const RELOAD_GUARD_KEY = 'grafana.plugin.reloadGuard';

// Substrings seen on the browser errors thrown when a dynamically imported module
// (e.g. a pinned plugin build asset) can no longer be fetched.
const MODULE_LOAD_ERROR_MARKERS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
];

/**
 * errorChain returns the error and its `cause` ancestors. importPluginModule wraps a
 * SystemJS failure as `Error('Could not load plugin', { cause: originalError })`, so the
 * recoverable ChunkLoadError / dynamic-import failure is on the cause, not the top-level
 * error. Bounded and cycle-guarded so a self-referential cause cannot loop.
 */
function errorChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;
  while (current instanceof Error && chain.length < 10 && !chain.includes(current)) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

/**
 * A recoverable build error is one where the code the client is running has been
 * superseded server-side: a ChunkLoadError or a failed dynamic module import (possibly
 * wrapped by importPluginModule — hence the cause-chain walk). Reloading loads the
 * current build. (A build-addressed asset evicted server-side surfaces as one of these —
 * the browser does not expose the 410 HTTP status on the thrown error, so recovery keys
 * on the error, not the status.)
 */
export function isRecoverableBuildError(error: unknown): boolean {
  return errorChain(error).some((e) => {
    if (e.name === 'ChunkLoadError') {
      return true;
    }
    const message = e.message?.toLowerCase() ?? '';
    if (MODULE_LOAD_ERROR_MARKERS.some((marker) => message.includes(marker))) {
      return true;
    }
    // SystemJS surfaces an HTTP failure while importing a module as e.g.
    // "410 Gone, loading https://…/public/plugins/…". A 410 means the pinned build was
    // evicted server-side — recover by reloading to pick up the current build.
    return /\b410\b/.test(message) && message.includes('loading');
  });
}

/**
 * isPluginBuildError reports whether a recoverable error (anywhere in its cause chain) is
 * attributable to a plugin build asset (its failing URL is under /public/plugins/), as
 * opposed to a core Grafana chunk. It selects the plugin-specific recovery copy so a
 * core-upgrade chunk failure is not mislabeled as a plugin update.
 */
export function isPluginBuildError(error: unknown): boolean {
  return errorChain(error).some((e) => (e.message?.toLowerCase() ?? '').includes('/public/plugins/'));
}

// sessionStorage access can throw (private mode, disabled storage, sandboxed
// third-party iframe). The recovery UI must degrade gracefully rather than let the
// throw escape and blank the error page, so both helpers swallow storage errors.
function reloadGuardWasSet(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) !== null;
  } catch {
    // Storage unavailable: treat as "not yet recovered" so a reload is still offered.
    return false;
  }
}

function setReloadGuard(): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: we cannot dedupe across a session, but reloading anyway is
    // better than crashing the recovery page.
  }
}

export function GrafanaRouteError({ error, errorInfo }: Props) {
  const styles = useStyles2(getStyles);

  const recoverable = isRecoverableBuildError(error);
  const guardSet = reloadGuardWasSet();

  // Show the warn-before-reload modal only for a recoverable error that has not
  // already triggered a recovery this session. Never auto-reload without consent.
  const [showModal, setShowModal] = useState(recoverable && !guardSet);

  const reload = () => {
    setReloadGuard();
    window.location.reload();
  };

  if (recoverable) {
    // A plugin build asset that was superseded gets plugin-specific copy; any other
    // recoverable chunk failure (e.g. a core Grafana chunk after an upgrade) keeps the
    // accurate "Grafana has likely been updated" messaging rather than being mislabeled.
    const plugin = isPluginBuildError(error);
    const title = plugin
      ? t('plugin-build-recovery.title', 'This plugin has been updated')
      : t('route-error.title', 'Unable to find application file');
    const description = plugin
      ? t(
          'plugin-build-recovery.description',
          'The version of this plugin you were using is no longer available because it was updated or removed. Reloading will load the current version.'
        )
      : t('route-error.description', 'Grafana has likely been updated. Please try reloading the page.');

    return (
      <Page navId="error" layout={PageLayoutType.Canvas}>
        <div className={styles.container}>
          <h2>{title}</h2>
          <br />
          <h2 className="page-heading">{description}</h2>
          <br />
          <Button size="md" variant="secondary" icon="repeat" onClick={reload}>
            <Trans i18nKey="plugin-build-recovery.reload-button">Reload</Trans>
          </Button>
        </div>
        <ConfirmModal
          isOpen={showModal}
          title={title}
          body={description}
          confirmText={t('plugin-build-recovery.reload-now-button', 'Reload now')}
          confirmVariant="primary"
          dismissText={t('plugin-build-recovery.not-now-button', 'Not now')}
          onConfirm={reload}
          onDismiss={() => setShowModal(false)}
        />
      </Page>
    );
  }

  // Would be good to know the page navId here but needs a pretty big refactoring
  return (
    <Page navId="error" layout={PageLayoutType.Canvas}>
      <div className={styles.container}>
        <ErrorWithStack
          title={t('route-error.error-unexpected-title', 'An unexpected error happened')}
          error={error}
          errorInfo={errorInfo}
        />
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '500px',
    margin: theme.spacing(8, 'auto'),
  }),
});
