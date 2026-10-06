import { css } from '@emotion/css';
import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, LoadingState, type PanelData, type PanelProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Alert, Button, useStyles2, useTheme2 } from '@grafana/ui';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { followLink } from './followLink';
import {
  MAX_HEIGHT_HINT_PX,
  RENDER_FRAME_SANDBOX,
  buildRenderDocument,
  createRenderFrameController,
  holdRenderReadiness,
  readHostNonce,
  getRenderInputBuilder,
  validateRenderLink,
  type RenderLocation,
  type RenderFrameController,
  type RenderFrameError,
  type RenderFrameErrorKind,
  type RenderReadinessHold,
} from './runtime';
import { DEFAULT_API_VERSION, type Options } from './types';

type LimitError = { reason: 'too-many-frames' | 'too-many-cells' | 'too-large'; actual: number; limit: number };

// 'PartialResult' is not a LoadingState member yet, but the protocol accepts it as final.
const TERMINAL_STATES: ReadonlySet<string> = new Set([LoadingState.Done, LoadingState.Error, 'PartialResult']);

/** Errors for one draw: a draw of final data that fails will not draw anything else. */
const SETTLING_ERRORS: ReadonlySet<RenderFrameErrorKind> = new Set(['runtime', 'output-limit', 'render-timeout']);

export function CustomPanel(props: PanelProps<Options>) {
  const styles = useStyles2(getStyles);
  const code = props.options.code ?? '';

  if (code.trim() === '') {
    return (
      <div className={styles.message}>
        <Trans i18nKey="custom-panel.empty-code">Add drawing code in the panel options to render this panel.</Trans>
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
  id,
  title,
  data,
  timeRange,
  timeZone,
  options,
  fieldConfig,
  width,
  height,
  transparent,
  fitContent,
}: PanelProps<Options> & { code: string }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const renderTarget = useMemo(() => isRenderTarget(), []);
  const apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
  const buildInput = getRenderInputBuilder(apiVersion);
  const doc = useMemo(
    () => buildRenderDocument({ code, apiVersion, isRenderTarget: renderTarget, nonce: readHostNonce() }),
    [code, apiVersion, renderTarget]
  );

  const [reloadCount, setReloadCount] = useState(0);
  const [controller, setController] = useState<RenderFrameController | null>(null);
  const [fatalError, setFatalError] = useState<RenderFrameError | null>(null);
  const [frameError, setFrameError] = useState<RenderFrameError | null>(null);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [heightHint, setHeightHint] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RenderFrameController | null>(null);
  // One hold per draw of final data. The first hold is taken with the frame, before any data, so
  // the image renderer also waits for the frame to start.
  const holdRef = useRef<RenderReadinessHold | null>(null);
  // The latest seq of final data the hold waits for; undefined while no final data was sent yet.
  const holdSeqRef = useRef<number | undefined>(undefined);
  const lastInputFinalRef = useRef(false);
  // An iframe that loaded before its controller existed; the controller picks it up on creation.
  const pendingLoadRef = useRef<HTMLIFrameElement | null>(null);

  const frameKey = doc.ok && buildInput ? `${doc.documentKey}:${reloadCount}` : null;

  const releaseHold = useCallback(() => {
    holdRef.current?.release();
    holdSeqRef.current = undefined;
  }, []);

  const holdForSeq = useCallback((seq: number) => {
    if (!holdRef.current || holdRef.current.released) {
      holdRef.current = holdRenderReadiness();
    }
    holdSeqRef.current = seq;
  }, []);

  // The frame draws only the latest input, so a later seq settles an earlier one too.
  const settleSeq = useCallback(
    (seq: number | undefined) => {
      if (seq !== undefined && holdSeqRef.current !== undefined && seq >= holdSeqRef.current) {
        releaseHold();
      }
    },
    [releaseHold]
  );

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
      void followLink(target);
    }
  }, []);

  useEffect(() => {
    if (!frameKey) {
      return undefined;
    }
    holdRef.current = holdRenderReadiness();
    holdSeqRef.current = undefined;
    setFatalError(null);
    setFrameError(null);
    setHeightHint(null);

    const created = createRenderFrameController({
      onReady: () => {},
      onRenderComplete: ({ seq }) => {
        setFrameError(null);
        settleSeq(seq);
      },
      onHeight: (value) => setHeightHint(value),
      onError: (error) => {
        if (error.fatal) {
          setFatalError(error);
          releaseHold();
          return;
        }
        setFrameError(error);
        // A startup error comes before any draw: the code may never draw at all.
        if (error.kind === 'startup') {
          releaseHold();
        } else if (SETTLING_ERRORS.has(error.kind)) {
          settleSeq(error.seq);
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
      releaseHold();
      if (controllerRef.current === created) {
        controllerRef.current = null;
      }
    };
  }, [frameKey, handleLink, releaseHold, settleSeq]);

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

  // Dashboard variables, time range and tabs are URL-synced: a URL change redraws, even when it
  // changes nothing the queries use.
  const location = useDashboardLocation();

  // Push data to the frame. A change of size alone becomes a resize so the frame reuses its input.
  const sentRef = useRef<{
    controller: RenderFrameController;
    sources: unknown[];
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!controller || !buildInput) {
      return;
    }
    const sources = [
      data,
      timeRange,
      timeZone,
      theme,
      id,
      title,
      options,
      fieldConfig,
      transparent,
      fitContent,
      location,
    ];
    const sent = sentRef.current;
    const sameSources =
      sent !== null && sent.controller === controller && sent.sources.every((value, i) => value === sources[i]);

    if (sameSources) {
      if (sent.width === width && sent.height === height) {
        return;
      }
      sentRef.current = { ...sent, width, height };
      const seq = controller.resize({ width, height });
      if (seq >= 0 && lastInputFinalRef.current) {
        holdForSeq(seq);
      }
      return;
    }

    const result = buildInput({
      id,
      title,
      data,
      timeRange,
      timeZone,
      options,
      fieldConfig,
      theme,
      width,
      height,
      transparent,
      fitContent: fitContent === true,
      location,
    });
    if (!result.ok) {
      setLimitError({ reason: result.reason, actual: result.actual, limit: result.limit });
      sentRef.current = null;
      releaseHold();
      return;
    }
    setLimitError(null);
    sentRef.current = { controller, sources, width, height };
    lastInputFinalRef.current = isFinalData(data);
    const seq = controller.render(result.input);
    if (seq >= 0 && lastInputFinalRef.current) {
      holdForSeq(seq);
    }
  }, [
    controller,
    buildInput,
    id,
    title,
    data,
    timeRange,
    timeZone,
    options,
    fieldConfig,
    theme,
    width,
    height,
    transparent,
    fitContent,
    location,
    releaseHold,
    holdForSeq,
  ]);

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

  if (!buildInput) {
    return (
      <div className={styles.message}>
        <Alert
          severity="error"
          title={t('custom-panel.errors.unsupported-api-version-title', 'Unsupported drawing API version')}
        >
          {t(
            'custom-panel.errors.unsupported-api-version',
            'This panel was saved with drawing API version {{version}}, which this version of Grafana does not support. Update Grafana or set the panel to a supported version.',
            { version: String(apiVersion) }
          )}
        </Alert>
      </div>
    );
  }

  if (!doc.ok) {
    return (
      <div className={styles.message}>
        <Alert severity="error" title={t('custom-panel.errors.code-too-large-title', 'Drawing code is too large')}>
          {t(
            'custom-panel.errors.code-too-large',
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
            {t('custom-panel.errors.retry', 'Retry')}
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
          title={t('custom-panel.frame-title', 'Panel drawing')}
          onLoad={onLoad}
        />
      )}
      {!fatalError && limitError && (
        <div className={styles.overlay}>
          <Alert severity="warning" title={t('custom-panel.errors.limit-title', 'Too much data to draw')}>
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

/** The page URL, which carries the URL-synced dashboard state. Equal URLs keep the same object. */
function useDashboardLocation(): RenderLocation {
  const [location, setLocation] = useState<RenderLocation>(() => readLocation());
  useEffect(() => {
    const subscription = locationService.getLocationObservable().subscribe(({ pathname, search }) => {
      setLocation((previous) =>
        previous.pathname === pathname && previous.search === search ? previous : { pathname, search }
      );
    });
    return () => subscription.unsubscribe();
  }, []);
  return location;
}

function readLocation(): RenderLocation {
  const { pathname, search } = locationService.getLocation();
  return { pathname, search };
}

function limitErrorMessage({ reason, actual, limit }: LimitError): string {
  switch (reason) {
    case 'too-many-frames':
      return t(
        'custom-panel.errors.too-many-frames',
        'The queries returned {{actual}} frames. The custom panel draws at most {{limit}}.',
        { actual, limit }
      );
    case 'too-many-cells':
      return t(
        'custom-panel.errors.too-many-cells',
        'The queries returned {{actual}} values. The custom panel draws at most {{limit}}. Reduce the time range or add a limit to the query.',
        { actual, limit }
      );
    case 'too-large':
      return t(
        'custom-panel.errors.too-large',
        'The data is {{actual}} bytes once serialized. The custom panel sends at most {{limit}} bytes to the drawing code.',
        { actual, limit }
      );
  }
}

function frameErrorTitle(kind: RenderFrameErrorKind): string {
  switch (kind) {
    case 'startup':
      return t('custom-panel.errors.startup', 'The drawing code failed to start');
    case 'runtime':
      return t('custom-panel.errors.runtime', 'The drawing code failed');
    case 'csp':
      return t('custom-panel.errors.csp', 'The drawing code tried something the sandbox does not allow');
    case 'output-limit':
      return t('custom-panel.errors.output-limit', 'The drawing produced too many elements');
    case 'render-timeout':
      return t('custom-panel.errors.render-timeout', 'The drawing code took too long to finish');
    default:
      return fatalErrorMessage(kind);
  }
}

function fatalErrorMessage(kind: RenderFrameErrorKind): string {
  switch (kind) {
    case 'startup-timeout':
      return t('custom-panel.errors.startup-timeout', 'The drawing sandbox did not start in time.');
    case 'unresponsive':
      return t('custom-panel.errors.unresponsive', 'The drawing code stopped responding.');
    case 'navigated-away':
      return t('custom-panel.errors.navigated-away', 'The drawing code tried to navigate away and was stopped.');
    case 'protocol':
      return t('custom-panel.errors.protocol', 'The drawing sandbox sent an invalid message and was stopped.');
    case 'rate-limit':
      return t('custom-panel.errors.rate-limit', 'The drawing code sent too many messages and was stopped.');
    default:
      return t('custom-panel.errors.generic', 'The drawing sandbox stopped.');
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
