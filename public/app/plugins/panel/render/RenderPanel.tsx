import { css } from '@emotion/css';
import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, LoadingState, type PanelData, type PanelProps, urlUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Alert, Button, useStyles2, useTheme2 } from '@grafana/ui';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import {
  MAX_HEIGHT_HINT_PX,
  RENDER_FRAME_SANDBOX,
  buildRenderDocument,
  buildRenderInput,
  createRenderFrameController,
  holdRenderReadiness,
  readHostNonce,
  validateRenderLink,
  type RenderFrameController,
  type RenderFrameError,
  type RenderFrameErrorKind,
  type RenderLinkTarget,
} from './runtime';
import { type Options } from './types';

type LimitError = { reason: 'too-many-frames' | 'too-many-cells' | 'too-large'; actual: number; limit: number };

// 'PartialResult' is not a LoadingState member yet, but the protocol accepts it as final.
const TERMINAL_STATES: ReadonlySet<string> = new Set([LoadingState.Done, LoadingState.Error, 'PartialResult']);

export function RenderPanel(props: PanelProps<Options>) {
  const styles = useStyles2(getStyles);
  const code = props.options.code ?? '';

  if (code.trim() === '') {
    return (
      <div className={styles.message}>
        <Trans i18nKey="render-panel.empty-code">Add drawing code in the panel options to render this panel.</Trans>
      </div>
    );
  }

  return <RenderFrameHost {...props} code={code} />;
}

/** True when the frame has nothing more to wait for: the data that was drawn will not change. */
function isFinalData(data: PanelData): boolean {
  if (TERMINAL_STATES.has(data.state)) {
    return true;
  }
  // A panel without queries never leaves NotStarted and never gets a request.
  return data.state === LoadingState.NotStarted && !data.request;
}

function RenderFrameHost({
  code,
  data,
  timeRange,
  timeZone,
  width,
  height,
  replaceVariables,
  fitContent,
}: PanelProps<Options> & { code: string }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const renderTarget = useMemo(() => isRenderTarget(), []);
  const doc = useMemo(
    () => buildRenderDocument({ code, isRenderTarget: renderTarget, nonce: readHostNonce() }),
    [code, renderTarget]
  );

  const [reloadCount, setReloadCount] = useState(0);
  const [controller, setController] = useState<RenderFrameController | null>(null);
  const [fatalError, setFatalError] = useState<RenderFrameError | null>(null);
  const [frameError, setFrameError] = useState<RenderFrameError | null>(null);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [heightHint, setHeightHint] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RenderFrameController | null>(null);
  const holdRef = useRef<ReturnType<typeof holdRenderReadiness> | null>(null);
  // seq -> whether the data drawn for that seq is final, used to decide when readiness is released.
  const finalBySeqRef = useRef(new Map<number, boolean>());
  const lastInputFinalRef = useRef(false);
  // An iframe that loaded before its controller existed; the controller picks it up on creation.
  const pendingLoadRef = useRef<HTMLIFrameElement | null>(null);

  const frameKey = doc.ok ? `${doc.documentKey}:${reloadCount}` : null;

  const releaseHold = useCallback(() => {
    holdRef.current?.release();
  }, []);

  const handleLink = useCallback((href: string) => {
    if (config.publicDashboardAccessToken) {
      return;
    }
    // Only follow links that come right after a user gesture; userActivation is missing in some browsers.
    const activation = 'userActivation' in navigator ? navigator.userActivation : undefined;
    if (activation && !activation.isActive) {
      return;
    }
    const target = validateRenderLink(href);
    if (target) {
      followLink(target);
    }
  }, []);

  useEffect(() => {
    if (!frameKey) {
      return undefined;
    }
    const hold = holdRenderReadiness();
    holdRef.current = hold;
    finalBySeqRef.current = new Map();
    setFatalError(null);
    setFrameError(null);
    setHeightHint(null);

    const created = createRenderFrameController({
      onReady: () => {},
      onRenderComplete: ({ seq }) => {
        setFrameError(null);
        if (finalBySeqRef.current.get(seq)) {
          hold.release();
        }
      },
      onHeight: (value) => setHeightHint(value),
      onError: (error) => {
        if (error.fatal) {
          setFatalError(error);
          hold.release();
          return;
        }
        setFrameError(error);
        if (error.kind === 'render-timeout') {
          hold.release();
        }
      },
      onLink: handleLink,
    });
    controllerRef.current = created;
    setController(created);

    if (pendingLoadRef.current) {
      created.handleLoad(pendingLoadRef.current);
      pendingLoadRef.current = null;
    }

    return () => {
      created.dispose();
      hold.release();
      if (controllerRef.current === created) {
        controllerRef.current = null;
      }
    };
  }, [frameKey, handleLink]);

  // A fatal error already removed the iframe, which tears its document down; a retry mounts a new
  // element with a new controller.
  const retry = useCallback(() => {
    setFatalError(null);
    setReloadCount((count) => count + 1);
  }, []);

  const onLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = event.currentTarget;
    if (controllerRef.current) {
      controllerRef.current.handleLoad(iframe);
    } else {
      pendingLoadRef.current = iframe;
    }
  }, []);

  // Push data to the frame. A change of size alone becomes a resize so the frame reuses its input.
  const sentRef = useRef<{ controller: RenderFrameController; sources: unknown[] } | null>(null);
  useEffect(() => {
    if (!controller) {
      return;
    }
    const sources = [data, timeRange, timeZone, theme, replaceVariables];
    const sent = sentRef.current;
    const sameSources =
      sent !== null && sent.controller === controller && sent.sources.every((value, i) => value === sources[i]);

    if (sameSources) {
      const seq = controller.resize({ width, height });
      if (seq >= 0) {
        finalBySeqRef.current.set(seq, lastInputFinalRef.current);
      }
      return;
    }

    const result = buildRenderInput({
      data,
      timeRange,
      timeZone,
      replaceVariables,
      theme,
      width,
      height,
      isRenderTarget: renderTarget,
    });
    if (!result.ok) {
      setLimitError({ reason: result.reason, actual: result.actual, limit: result.limit });
      sentRef.current = null;
      releaseHold();
      return;
    }
    setLimitError(null);
    sentRef.current = { controller, sources };
    lastInputFinalRef.current = isFinalData(data);
    const seq = controller.render(result.input);
    if (seq >= 0) {
      finalBySeqRef.current.set(seq, lastInputFinalRef.current);
    }
  }, [controller, data, timeRange, timeZone, theme, replaceVariables, width, height, renderTarget, releaseHold]);

  // Pause drawing while the panel is scrolled out of view. Render targets always draw.
  useEffect(() => {
    const element = containerRef.current;
    if (!controller || renderTarget || !element || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry?.isIntersecting) {
        controller.resume();
      } else {
        controller.pause();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [controller, renderTarget]);

  if (!doc.ok) {
    return (
      <div className={styles.message}>
        <Alert severity="error" title={t('render-panel.errors.code-too-large-title', 'Drawing code is too large')}>
          {t(
            'render-panel.errors.code-too-large',
            'The drawing code is {{bytes}} bytes, over the limit for this panel.',
            {
              bytes: doc.bytes,
            }
          )}
        </Alert>
      </div>
    );
  }

  const frameHeight =
    fitContent && heightHint !== null ? `${Math.min(Math.max(heightHint, 0), MAX_HEIGHT_HINT_PX)}px` : '100%';

  return (
    <div ref={containerRef} className={styles.container}>
      {fatalError ? (
        <div className={styles.message} role="alert">
          <p>{fatalErrorMessage(fatalError.kind)}</p>
          <Button variant="secondary" icon="sync" onClick={retry}>
            {t('render-panel.errors.retry', 'Retry')}
          </Button>
        </div>
      ) : (
        <iframe
          key={frameKey ?? undefined}
          className={styles.frame}
          style={{ height: frameHeight }}
          sandbox={RENDER_FRAME_SANDBOX}
          srcDoc={doc.srcdoc}
          referrerPolicy="no-referrer"
          title={t('render-panel.frame-title', 'Panel drawing')}
          onLoad={onLoad}
        />
      )}
      {!fatalError && limitError && (
        <div className={styles.overlay}>
          <Alert severity="warning" title={t('render-panel.errors.limit-title', 'Too much data to draw')}>
            {limitErrorMessage(limitError)}
          </Alert>
        </div>
      )}
      {!fatalError && !limitError && frameError && (
        <div className={styles.overlay}>
          <Alert severity="error" title={frameErrorTitle(frameError.kind)}>
            {frameError.message && <pre className={styles.diagnostic}>{frameError.message}</pre>}
          </Alert>
        </div>
      )}
    </div>
  );
}

function followLink(target: RenderLinkTarget) {
  switch (target.kind) {
    case 'view-panel':
      locationService.partial({ viewPanel: `panel-${target.panelId}` });
      return;
    case 'dashboard-state':
      locationService.partial(target.params);
      return;
    case 'dashboard':
      locationService.push(urlUtil.renderUrl(target.path, target.params));
      return;
  }
}

function limitErrorMessage({ reason, actual, limit }: LimitError): string {
  switch (reason) {
    case 'too-many-frames':
      return t(
        'render-panel.errors.too-many-frames',
        'The queries returned {{actual}} frames. The render panel draws at most {{limit}}.',
        { actual, limit }
      );
    case 'too-many-cells':
      return t(
        'render-panel.errors.too-many-cells',
        'The queries returned {{actual}} values. The render panel draws at most {{limit}}. Reduce the time range or add a limit to the query.',
        { actual, limit }
      );
    case 'too-large':
      return t(
        'render-panel.errors.too-large',
        'The data is {{actual}} bytes once serialized. The render panel sends at most {{limit}} bytes to the drawing code.',
        { actual, limit }
      );
  }
}

function frameErrorTitle(kind: RenderFrameErrorKind): string {
  switch (kind) {
    case 'startup':
      return t('render-panel.errors.startup', 'The drawing code failed to start');
    case 'runtime':
      return t('render-panel.errors.runtime', 'The drawing code failed');
    case 'csp':
      return t('render-panel.errors.csp', 'The drawing code tried something the sandbox does not allow');
    case 'output-limit':
      return t('render-panel.errors.output-limit', 'The drawing produced too many elements');
    case 'render-timeout':
      return t('render-panel.errors.render-timeout', 'The drawing code took too long to finish');
    default:
      return fatalErrorMessage(kind);
  }
}

function fatalErrorMessage(kind: RenderFrameErrorKind): string {
  switch (kind) {
    case 'startup-timeout':
      return t('render-panel.errors.startup-timeout', 'The drawing sandbox did not start in time.');
    case 'unresponsive':
      return t('render-panel.errors.unresponsive', 'The drawing code stopped responding.');
    case 'navigated-away':
      return t('render-panel.errors.navigated-away', 'The drawing code tried to navigate away and was stopped.');
    case 'protocol':
      return t('render-panel.errors.protocol', 'The drawing sandbox sent an invalid message and was stopped.');
    case 'rate-limit':
      return t('render-panel.errors.rate-limit', 'The drawing code sent too many messages and was stopped.');
    default:
      return t('render-panel.errors.generic', 'The drawing sandbox stopped.');
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  frame: css({
    display: 'block',
    border: 0,
    width: '100%',
    background: 'transparent',
  }),
  message: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
    textAlign: 'center',
  }),
  overlay: css({
    position: 'absolute',
    left: theme.spacing(1),
    right: theme.spacing(1),
    bottom: theme.spacing(1),
    maxHeight: '50%',
    overflow: 'auto',
  }),
  diagnostic: css({
    margin: 0,
    maxHeight: 120,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
