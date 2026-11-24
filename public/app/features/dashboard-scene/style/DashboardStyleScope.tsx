import { css, cx } from '@emotion/css';
import { createContext, type CSSProperties, type ReactNode, useContext, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ThemeContext, useTheme2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { useFigureNumberClass } from './figureNumbers';
import { registerStyleFonts } from './fonts';
import { createStyleTheme, getStyleCssVars, resolveDashboardStyle } from './resolveStyle';
import { type DashboardStyleChoice, type ResolvedDashboardStyle } from './types';
import { useViewerStyleChoice, type ViewerStyleChoice } from './viewerStyleChoice';

export interface DashboardStyleValue {
  style: ResolvedDashboardStyle;
  theme: GrafanaTheme2;
  cssVars: Record<string, string>;
  className: string;
}

const DashboardStyleContext = createContext<DashboardStyleValue | undefined>(undefined);

/** The resolved style of the dashboard being rendered, or undefined without one. */
export function useDashboardStyleContext(): DashboardStyleValue | undefined {
  return useContext(DashboardStyleContext);
}

/**
 * Resolves the dashboard's saved style with the viewer's own overrides on top. Memoised on the
 * inputs so panels keep a stable theme object between renders.
 */
export function useDashboardStyle(dashboard: DashboardScene): DashboardStyleValue | undefined {
  const { style: saved, uid } = dashboard.useState();
  const viewer = useViewerStyleChoice(uid);
  const hostTheme = useTheme2();

  const resolved = useMemo(() => {
    const choice = saved ? { ...saved, ...stripEmpty(viewer) } : undefined;
    return resolveDashboardStyle(choice, hostTheme);
  }, [saved, viewer, hostTheme]);
  const figureClass = useFigureNumberClass(dashboard, Boolean(resolved?.pack.treatments.figureNumbering));

  return useMemo(() => {
    if (!resolved) {
      return undefined;
    }
    registerStyleFonts();
    return {
      style: resolved,
      theme: createStyleTheme(resolved, hostTheme),
      cssVars: getStyleCssVars(resolved),
      className: cx(getScopeClassName(resolved), figureClass),
    };
  }, [resolved, hostTheme, figureClass]);
}

/** The viewer's overrides that are actually set; an empty choice keeps the author's. */
function stripEmpty(viewer: ViewerStyleChoice | undefined): Partial<DashboardStyleChoice> {
  return {
    ...(viewer?.palette && { palette: viewer.palette }),
    ...(viewer?.accent && { accent: viewer.accent }),
    ...(viewer?.typography && { typography: viewer.typography }),
  };
}

interface ScopeProps {
  value: DashboardStyleValue | undefined;
  children: ReactNode;
}

/** Gives its subtree the styled theme and context without adding an element. */
export function DashboardStyleProvider({ value, children }: ScopeProps) {
  if (!value) {
    return <>{children}</>;
  }
  return (
    <DashboardStyleContext.Provider value={value}>
      <ThemeContext.Provider value={value.theme}>{children}</ThemeContext.Provider>
    </DashboardStyleContext.Provider>
  );
}

/** Props that turn an existing element into the style's canvas: tokens, background and pack rules. */
export function getStyleCanvasProps(value: DashboardStyleValue | undefined): {
  className?: string;
  style?: CSSProperties;
  'data-dashboard-style'?: string;
} {
  if (!value) {
    return {};
  }
  return {
    className: value.className,
    // Custom properties are not in CSSProperties.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    style: value.cssVars as CSSProperties,
    'data-dashboard-style': value.style.pack.id,
  };
}

const RULES: Record<
  ResolvedDashboardStyle['pack']['treatments']['sectionRule'],
  (line: string, ink: string) => string
> = {
  none: () => 'none',
  hairline: (line) => `1px solid ${line}`,
  heavy: (_line, ink) => `3px solid ${ink}`,
  dashed: (line) => `1px dashed ${line}`,
};

const classNames = new Map<string, string>();

function getScopeClassName(style: ResolvedDashboardStyle): string {
  const key = `${style.pack.id}:${style.palette.id}:${style.mode}:${style.typography.id}:${style.accent?.id}`;
  const cached = classNames.get(key);
  if (cached) {
    return cached;
  }
  const className = buildScopeClassName(style);
  classNames.set(key, className);
  return className;
}

function buildScopeClassName(style: ResolvedDashboardStyle): string {
  const { treatments } = style.pack;
  const { colors } = style;
  const panelTitle = `[data-testid="${selectors.components.Panels.Panel.headerContainer}"] h2`;
  const strongLine = style.mode === 'dark' ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)';

  return cx(
    'dashboard-style',
    css({
      label: `dashboard-style-${style.pack.id}`,
      background: colors.bg,
      color: colors.ink,
      fontFamily: style.typography.body,
      fontFeatureSettings: '"tnum" 1',
      counterReset: 'dash-section',
      '--dash-section-rule': RULES[treatments.sectionRule](
        treatments.sectionRule === 'dashed' ? strongLine : colors.line,
        colors.ink
      ),
      '--dash-column-rule':
        treatments.columnRules === 'none'
          ? 'none'
          : `1px ${treatments.columnRules} ${treatments.columnRules === 'dashed' ? strongLine : colors.line}`,
      '--dash-column-rule-pad': treatments.columnRules === 'none' ? '0px' : '16px',
      '--dash-heading-size': `${treatments.headingSize}rem`,
      '--dash-masthead-size': `${treatments.mastheadSize}rem`,

      // Report emphasis: italic packs set a clause in italic; accent packs mark it in the accent.
      '& .dashboard-emphasis em': emphasisRule(treatments.emphasis, 'em'),
      '& .dashboard-emphasis strong': emphasisRule(treatments.emphasis, 'strong'),

      ...(treatments.headlinePanelTitles && {
        [`& ${panelTitle}`]: {
          fontFamily: 'var(--dash-font-display)',
          fontSize: '1.0625rem',
          fontWeight: 600,
          letterSpacing: '-0.005em',
        },
      }),
      ...(treatments.figureNumbering && {
        [`& ${panelTitle}::before`]: {
          fontFamily: 'var(--dash-font-mono)',
          fontSize: '0.8em',
          fontWeight: 400,
          color: colors.muted,
        },
      }),
      ...(treatments.sectionNumbering !== 'none' && {
        '& .dashboard-report-title::before': {
          counterIncrement: 'dash-section',
          content:
            treatments.sectionNumbering === 'roman'
              ? 'counter(dash-section, lower-roman) ".\\2002"'
              : '"§\\2009" counter(dash-section) "\\2003"',
          fontFamily: 'var(--dash-font-mono)',
          fontSize: '0.5em',
          fontWeight: 400,
          letterSpacing: 0,
          color: colors.muted,
          verticalAlign: '0.35em',
        },
      }),
    })
  );
}

function emphasisRule(emphasis: 'italic' | 'accent', element: 'em' | 'strong') {
  if (emphasis === 'accent') {
    return {
      color: 'var(--dash-accent)',
      fontStyle: 'normal',
      fontWeight: element === 'strong' ? 'inherit' : undefined,
    };
  }
  return element === 'em' ? { fontStyle: 'italic', fontWeight: 'inherit' } : { fontWeight: 600 };
}
