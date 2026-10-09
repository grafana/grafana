import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';
import { getMermaidConfig } from 'app/core/utils/mermaidConfig';

import { SandboxFrame } from './SandboxFrame';
import { inlineSandboxFonts } from './sandboxFonts';
import { getGlobalCss, textSandboxPolicy, type TextSandboxState } from './sandboxPolicy';
import { isTextNewFeaturesEnabled } from './utils';

interface TextSandboxRemediation {
  canAllow: boolean;
  allow: () => void;
}

export interface TextSandboxReport extends TextSandboxRemediation {
  state: TextSandboxState;
}

export interface TextSandboxProps {
  html: string;
  /** Any dataframe, even with zero rows, enables protection; omit restrictions only for no-data legacy content. */
  hasData?: boolean;
  testId?: string;
  className?: string;
  /** Undefined invalidates the previous report when the document or consumer is removed. */
  onStateChange?: (report: TextSandboxReport | undefined) => void;
}

export function TextSandbox({ html, hasData = true, testId, className, onStateChange }: TextSandboxProps) {
  const theme = useTheme2();
  const host = useRef<HTMLDivElement>(null);
  const currentReport = useRef<TextSandboxReport | undefined>(undefined);
  const [origins, setOrigins] = useState<string[]>([]);
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
      currentReport.current = undefined;
      if (!state) {
        onStateChange?.(undefined);
        return;
      }
      const canAllow = state.resources.length > 0 && state.resources.every((resource) => resource.origin !== undefined);
      const report: TextSandboxReport = {
        state,
        canAllow,
        allow: () => {
          // A dashboard may retain a report after its document or resource snapshot has changed.
          if (!canAllow || currentReport.current !== report) {
            return;
          }
          currentReport.current = undefined;
          setOrigins((current) => [
            ...new Set([
              ...current,
              ...state.resources.flatMap((resource) => (resource.origin ? [resource.origin] : [])),
            ]),
          ]);
        },
      };
      currentReport.current = report;
      onStateChange?.(report);
    },
    [onStateChange]
  );

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
          onState={onState}
          onHeight={onHeight}
        />
      </div>
    </div>
  );
}
