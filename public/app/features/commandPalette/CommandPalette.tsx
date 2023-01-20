import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarResults,
  KBarSearch,
  VisualState,
  useRegisterActions,
  useKBar,
  ActionImpl,
} from 'kbar';
import React, { useEffect, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ResultItem } from './ResultItem';
import { useDashboardResults } from './actions/dashboardActions';
import useActions from './actions/useActions';
import { CommandPaletteAction } from './types';
import { useMatches } from './useMatches';

export const CommandPalette = () => {
  const styles = useStyles2(getSearchStyles);

  const { query, showing, searchQuery } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
    searchQuery: state.searchQuery,
  }));

  const actions = useActions();
  useRegisterActions(actions, [actions]);
  const dashboardResults = useDashboardResults(searchQuery, showing);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: showing, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  // Report interaction when opened
  useEffect(() => {
    showing && reportInteraction('command_palette_opened');
  }, [showing]);

  return actions.length > 0 ? (
    <KBarPortal>
      <KBarPositioner className={styles.positioner}>
        <KBarAnimator className={styles.animator}>
          <FocusScope contain autoFocus restoreFocus>
            <div {...overlayProps} {...dialogProps}>
              <KBarSearch
                defaultPlaceholder={t('command-palette.search-box.placeholder', 'Search Grafana')}
                className={styles.search}
              />
              <RenderResults dashboardResults={dashboardResults} />
            </div>
          </FocusScope>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  ) : null;
};

interface RenderResultsProps {
  dashboardResults: CommandPaletteAction[];
}

const RenderResults = ({ dashboardResults }: RenderResultsProps) => {
  const { results, rootActionId } = useMatches();
  const styles = useStyles2(getSearchStyles);
  const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
  // because dashboard search results aren't registered as actions, we need to manually
  // convert them to ActionImpls before passing them as items to KBarResults
  const dashboardResultItems = useMemo(
    () => dashboardResults.map((dashboard) => new ActionImpl(dashboard, { store: {} })),
    [dashboardResults]
  );

  const items = useMemo(
    () => (dashboardResultItems.length > 0 ? [...results, dashboardsSectionTitle, ...dashboardResultItems] : results),
    [results, dashboardsSectionTitle, dashboardResultItems]
  );

  return (
    <KBarResults
      items={items}
      onRender={({ item, active }) => {
        // These items are rendered in a container, in a virtual list, so we cannot
        // use :first/last-child selectors, so we must mimic them in JS
        const isFirstItem = items[0] === item;
        const isLastItem = items[items.length - 1] === item;

        const renderedItem =
          typeof item === 'string' ? (
            <div className={styles.sectionHeader}>
              <div className={cx(styles.sectionHeaderInner, isFirstItem && styles.sectionHeaderInnerFirst)}>{item}</div>
            </div>
          ) : (
            <ResultItem action={item} active={active} currentRootActionId={rootActionId!} />
          );

        return isLastItem ? <div className={styles.lastItem}>{renderedItem}</div> : renderedItem;
      }}
    />
  );
};

const getSearchStyles = (theme: GrafanaTheme2) => ({
  positioner: css({
    zIndex: theme.zIndex.portal,
    marginTop: '0px',
    '&::before': {
      content: '""',
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      background: theme.components.overlay.background,
      backdropFilter: 'blur(1px)',
    },
  }),
  animator: css({
    maxWidth: theme.breakpoints.values.sm, // supposed to be 600...
    width: '100%',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    borderRadius: theme.shape.borderRadius(4),
    overflow: 'hidden',
    boxShadow: theme.shadows.z3,
  }),
  search: css({
    padding: theme.spacing(2, 3),
    fontSize: theme.typography.fontSize,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    border: 'none',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),

  // Virtual list measures margin incorrectly, so we need to split padding before/after border
  // over and inner and outer element
  sectionHeader: css({
    paddingTop: theme.spacing(2),
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.body.fontWeight,
    color: theme.colors.text.secondary,
  }),
  sectionHeaderInner: css({
    padding: theme.spacing(1, 2),
    borderTop: `1px solid ${theme.colors.border.medium}`,
  }),

  // We don't need the header above the first section
  sectionHeaderInnerFirst: css({
    borderTop: 'none',
    paddingTop: 0,
  }),

  // Last item gets extra padding so it's not clipped by the rounded corners on the container
  lastItem: css({
    paddingBottom: theme.spacing(1),
  }),
});
