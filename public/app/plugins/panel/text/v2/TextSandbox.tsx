import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';
import { getMermaidConfig } from 'app/core/utils/mermaidConfig';
import {
  clearBlocked,
  reportBlocked,
  useAllowedOrigins,
  type BlockedOrigin,
} from 'app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent';

import { SandboxFrame } from './SandboxFrame';
import { inlineSandboxFonts } from './sandboxFonts';
import { getGlobalCss, textSandboxPolicy, type TextSandboxState } from './sandboxPolicy';
import { isTextNewFeaturesEnabled } from './utils';

export interface TextSandboxProps {
  html: string;
  /** Any dataframe, even with zero rows, enables protection; omit restrictions only for no-data legacy content. */
  hasData?: boolean;
  testId?: string;
  className?: string;
  minHeight?: number;
  /** Reports blocked sources to the consent banner. */
  consent?: { panelId?: number; panelTitle: string; dashboardUid?: string };
}

export function TextSandbox({ html, hasData = true, testId, className, minHeight, consent }: TextSandboxProps) {
  const theme = useTheme2();
  const host = useRef<HTMLDivElement>(null);
  const consentKey = useId();
  const { dashboardUid, panelId, panelTitle } = consent ?? {};
  const origins = useAllowedOrigins(dashboardUid, panelId);
  const [globalCss, setGlobalCss] = useState('');
  const mermaid = useMemo(() => (isTextNewFeaturesEnabled() ? getMermaidConfig(theme) : undefined), [theme]);
  const fontRoot = `${window.__grafana_public_path__ || 'public/'}fonts/`;

  useLayoutEffect(() => {
    let disposed = false;
    const css = getGlobalCss();
    setGlobalCss(css.replace(/@font-face\s*\{[^}]*\}/g, ''));
    if (css.includes('@font-face')) {
      void inlineSandboxFonts(css, fontRoot).then((css) => {
        if (!disposed) {
          setGlobalCss(css);
        }
      });
    }
    return () => {
      disposed = true;
    };
  }, [theme, fontRoot]);
  const onHeight = useCallback(() => {
    host.current?.dispatchEvent(new Event('text-content-resized', { bubbles: true }));
  }, []);
  const onState = useCallback(
    (state: TextSandboxState | undefined) => {
      if (state && panelTitle !== undefined) {
        reportBlocked(consentKey, { dashboardUid, panelId, panelTitle, origins: blockedOrigins(state) });
      } else {
        clearBlocked(consentKey);
      }
    },
    [consentKey, dashboardUid, panelId, panelTitle]
  );
  useLayoutEffect(() => () => clearBlocked(consentKey), [consentKey]);

  return (
    <div className={className} data-testid={testId}>
      <div ref={host} style={{ position: 'relative' }}>
        <SandboxFrame
          html={hasData ? textUtil.sanitizeTextPanelContent(html) : html}
          globalCss={globalCss}
          policy={hasData ? textSandboxPolicy(origins, fontRoot) : undefined}
          mermaid={mermaid}
          diagramError={t('textng.sandbox.diagram-error', 'Diagram could not be rendered')}
          title={t('textng.sandbox.title', 'Text panel content')}
          minHeight={minHeight}
          onState={onState}
          onHeight={onHeight}
        />
      </div>
    </div>
  );
}

function blockedOrigins(state: TextSandboxState): BlockedOrigin[] {
  const byOrigin = new Map<string, { urls: Map<string, number>; truncated: boolean }>();
  for (const resource of state.resources) {
    if (!resource.origin) {
      continue;
    }
    const entry = byOrigin.get(resource.origin) ?? { urls: new Map(), truncated: false };
    for (const { url, count } of resource.urls ?? []) {
      entry.urls.set(url, Math.max(entry.urls.get(url) ?? 0, count));
    }
    entry.truncated ||= Boolean(resource.truncated);
    byOrigin.set(resource.origin, entry);
  }
  return Array.from(byOrigin, ([origin, { urls, truncated }]) => ({
    origin,
    urls: Array.from(urls, ([url, count]) => ({ url, count })),
    ...(truncated && { truncated }),
  }));
}
