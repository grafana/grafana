import { css } from '@emotion/css';
import classNames from 'clsx';
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type VizPanel, sceneGraph, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { renderMatchingSoloPanels, SoloPanelContextProvider } from '../solo/SoloPanelContext';

import { type DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

export interface Props {
  dashboard: DashboardScene;
  panelSearch?: string;
  panelsPerRow?: number;
}

const panelsPerRowCSSVar = '--panels-per-row';

interface PanelSearchScope {
  registerMatch: () => () => void;
  isFiltering: boolean;
  isCollapsed: boolean;
  variableRevision: number;
}

const PanelSearchScopeContext = createContext<PanelSearchScope | null>(null);

export function PanelSearchLayout(props: Props) {
  return props.dashboard.state.body instanceof DefaultGridLayoutManager ? (
    <ClassicPanelSearchLayout {...props} />
  ) : (
    <FlatPanelSearchLayout {...props} />
  );
}

function ClassicPanelSearchLayout({ dashboard, panelSearch = '', panelsPerRow }: Props) {
  const { body } = dashboard.state;
  const gridStyle: CSSProperties & { [panelsPerRowCSSVar]: number | undefined } = {
    [panelsPerRowCSSVar]: panelsPerRow,
  };
  const styles = useStyles2(getStyles);
  const soloPanelContext = useMemo(() => new SoloPanelContextValueWithSearchStringFilter(panelSearch), [panelSearch]);
  const [variableRevision, refreshVariables] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    // Hidden panels are inactive, so their title dependencies cannot trigger rendering themselves.
    const sub = dashboard.subscribeToEvent(SceneVariableValueChangedEvent, refreshVariables);
    return () => sub.unsubscribe();
  }, [dashboard]);

  const registerMatch = useMemo(() => {
    let count = 0;
    return () => {
      count++;
      soloPanelContext.matchFound = true;
      return () => {
        soloPanelContext.matchFound = --count > 0;
      };
    };
  }, [soloPanelContext]);
  const scope = useMemo(
    () => ({ registerMatch, isFiltering: panelSearch !== '', isCollapsed: false, variableRevision }),
    [registerMatch, panelSearch, variableRevision]
  );

  return (
    <div className={classNames(styles.grid, { [styles.perRow]: panelsPerRow !== undefined })} style={gridStyle}>
      <PanelSearchScopeContext.Provider value={scope}>
        <SoloPanelContextProvider value={soloPanelContext} singleMatch={false} dashboard={dashboard}>
          <body.Component model={body} />
        </SoloPanelContextProvider>
      </PanelSearchScopeContext.Provider>
    </div>
  );
}

export function PanelSearchRow({
  isCollapsed,
  children,
}: {
  isCollapsed: boolean;
  children: (showRow: boolean) => ReactNode;
}) {
  const parent = useContext(PanelSearchScopeContext);
  const parentRegisterMatch = parent?.registerMatch;
  const [matchCount, setMatchCount] = useState(0);
  const styles = useStyles2(getStyles);
  const registerMatch = useCallback(() => {
    setMatchCount((count) => count + 1);
    const unregisterParent = parentRegisterMatch?.();
    return () => {
      setMatchCount((count) => count - 1);
      unregisterParent?.();
    };
  }, [parentRegisterMatch]);
  const collapsed = isCollapsed || parent?.isCollapsed === true;
  const isFiltering = parent?.isFiltering ?? false;
  const showRow = !isFiltering || matchCount > 0;
  const variableRevision = parent?.variableRevision ?? 0;
  const scope = useMemo(
    () => ({ registerMatch, isFiltering, isCollapsed: collapsed, variableRevision }),
    [registerMatch, isFiltering, collapsed, variableRevision]
  );

  return (
    <div className={styles.row} style={{ display: showRow ? undefined : 'none' }}>
      <PanelSearchScopeContext.Provider value={scope}>{children(showRow)}</PanelSearchScopeContext.Provider>
    </div>
  );
}

export function PanelSearchGrid({ children }: { children: ReactNode }) {
  const scope = useContext(PanelSearchScopeContext);
  const styles = useStyles2(getStyles);

  // Keep layouts and repeaters mounted to discover matches without activating collapsed panels.
  return (
    <div className={styles.grid} style={{ display: scope?.isCollapsed ? 'none' : undefined }}>
      {children}
    </div>
  );
}

export function PanelSearchResult({
  panel,
  filter,
  isLazy,
}: {
  panel: VizPanel;
  filter: SoloPanelContextValueWithSearchStringFilter;
  isLazy: boolean;
}) {
  panel.useState();
  const scope = useContext(PanelSearchScopeContext);
  const registerMatch = scope?.registerMatch;
  const styles = useStyles2(getStyles);
  const matches = filter.matches(panel);

  useEffect(() => {
    if (matches) {
      return registerMatch?.();
    }
    return;
  }, [matches, registerMatch]);

  if (!matches || scope?.isCollapsed) {
    return null;
  }

  return <div className={styles.panel}>{renderMatchingSoloPanels(filter, [panel], isLazy)}</div>;
}

function FlatPanelSearchLayout({ dashboard, panelSearch = '', panelsPerRow }: Props) {
  const { body } = dashboard.state;
  const gridStyle: CSSProperties & { [panelsPerRowCSSVar]: number | undefined } = {
    [panelsPerRowCSSVar]: panelsPerRow,
  };
  const styles = useStyles2(getStyles);
  const soloPanelContext = useMemo(() => new SoloPanelContextValueWithSearchStringFilter(panelSearch), [panelSearch]);

  return (
    <div
      className={classNames(styles.grid, styles.flatGrid, { [styles.perRow]: panelsPerRow !== undefined })}
      style={gridStyle}
    >
      <SoloPanelContextProvider value={soloPanelContext} singleMatch={false} dashboard={dashboard}>
        <body.Component model={body} />
      </SoloPanelContextProvider>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'var(--panel-search-columns, repeat(auto-fit, minmax(400px, 1fr)))',
      gap: theme.spacing(1),
    }),
    flatGrid: css({ gridAutoRows: '320px' }),
    perRow: css({
      '--panel-search-columns': `repeat(var(${panelsPerRowCSSVar}, 3), minmax(0, 1fr))`,
    }),
    row: css({
      gridColumn: '1 / -1',
      minWidth: 0,
    }),
    panel: css({
      height: 320,
      minWidth: 0,
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
    }),
    noHits: css({
      display: 'grid',
      placeItems: 'center',
    }),
  };
}

export class SoloPanelContextValueWithSearchStringFilter {
  public matchFound = false;

  public constructor(private searchQuery: string) {}

  public matches(panel: VizPanel): boolean {
    const interpolatedSearchString = sceneGraph.interpolate(panel, this.searchQuery);
    const interpolatedTitle = panel.interpolate(panel.state.title, undefined, 'text');

    let match: boolean;
    try {
      const regex = new RegExp(interpolatedSearchString, 'i');
      match = regex.test(interpolatedTitle);
    } catch {
      match = false;
    }

    if (!match) {
      match = interpolatedTitle.toLowerCase().includes(interpolatedSearchString.toLowerCase());
    }

    if (match) {
      this.matchFound = true;
    }

    return match;
  }
}
