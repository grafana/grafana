import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { textUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Alert, Button, useTheme2 } from '@grafana/ui';

import { getGlobalCss, mountTextSandbox, textSandboxPolicy, type TextSandboxState } from './sandboxFrame';

export interface TextSandboxConsent {
  resources: Extract<TextSandboxState, { status: 'blocked' }>['resources'];
  allow: () => void;
}

interface Props {
  html: string;
  testId?: string;
  className?: string;
  renderConsent?: (consent: TextSandboxConsent) => ReactNode;
}

export function TextSandbox({ html, testId, className, renderConsent = DefaultConsent }: Props) {
  const theme = useTheme2();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<TextSandboxState>({ status: 'loading' });
  const [origins, setOrigins] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (!host.current) {
      return;
    }
    const fontRoot = `${window.__grafana_public_path__ || 'public/'}fonts/`;
    return mountTextSandbox(host.current, {
      html: textUtil.sanitizeTextPanelContent(html),
      css: getGlobalCss(),
      policy: textSandboxPolicy(origins, fontRoot),
      title: t('textng.sandbox.title', 'Text panel content'),
      onState: setState,
      onHeight: () => host.current?.dispatchEvent(new Event('text-content-resized', { bubbles: true })),
    });
  }, [html, origins, theme]);

  return (
    <div className={className} data-testid={testId}>
      {state.status === 'loading' && <div role="status">{t('textng.sandbox.loading', 'Loading content…')}</div>}
      {state.status === 'error' && (
        <Alert
          severity="warning"
          title={t('textng.sandbox.unavailable', 'Secure text rendering is unavailable in this browser')}
        />
      )}
      {state.status === 'blocked' &&
        renderConsent({
          resources: state.resources,
          allow: () =>
            setOrigins((current) => [
              ...new Set([
                ...current,
                ...state.resources.flatMap((resource) => (resource.origin ? [resource.origin] : [])),
              ]),
            ]),
        })}
      <div ref={host} style={{ position: 'relative' }} />
    </div>
  );
}

function DefaultConsent({ resources, allow }: TextSandboxConsent) {
  const canAllow = resources.every((resource) => resource.origin !== undefined);
  return (
    <Alert severity="warning" title={t('textng.sandbox.blocked', 'External resources were blocked')}>
      <p>{resources.map((resource) => resource.origin ?? resource.directive).join(', ')}</p>
      {canAllow ? (
        <Button data-testid={selectors.components.Panels.Visualization.Text.allowResourcesButton} onClick={allow}>
          {t('textng.sandbox.allow', 'Allow')}
        </Button>
      ) : (
        <p>{t('textng.sandbox.policy-blocked', 'These resources cannot be allowed by the text panel.')}</p>
      )}
    </Alert>
  );
}
