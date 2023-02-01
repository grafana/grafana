import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarSearch,
  VisualState,
  useRegisterActions,
  useKBar,
  ActionImpl,
} from 'kbar';
import React, { useEffect, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { KBarResults } from './KBarResults';
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

  const actions = useActions(searchQuery);
  useRegisterActions(actions, [actions]);
  const { dashboardResults, isFetchingDashboardResults } = useDashboardResults(searchQuery, showing);

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
              <div className={styles.searchContainer}>
                {isFetchingDashboardResults ? <Spinner className={styles.spinner} /> : <Icon name="search" size="md" />}
                <KBarSearch
                  defaultPlaceholder={t('command-palette.search-box.placeholder', 'Search or jump to...')}
                  className={styles.search}
                />
              </div>
              <div className={styles.resultsContainer}>
                <RenderResults dashboardResults={dashboardResults} />
              </div>
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
      maxHeight={650}
      onRender={({ item, active }) => {
        const isFirst = items[0] === item;

        const renderedItem =
          typeof item === 'string' ? (
            <div className={cx(styles.sectionHeader, isFirst && styles.sectionHeaderFirst)}>{item}</div>
          ) : (
            <ResultItem action={item} active={active} currentRootActionId={rootActionId!} />
          );

        return renderedItem;
      }}
    />
  );
};

const getSearchStyles = (theme: GrafanaTheme2) => {
  const topNavCommandPalette = Boolean(config.featureToggles.topNavCommandPalette);

  return {
    positioner: css({
      zIndex: theme.zIndex.portal,
      marginTop: '0px',
      paddingTop: topNavCommandPalette ? '4px !important' : undefined,
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
      maxWidth: theme.breakpoints.values.md,
      width: '100%',
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.borderRadius(2),
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
      boxShadow: theme.shadows.z3,
    }),
    searchContainer: css({
      alignItems: 'center',
      background: theme.components.input.background,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
    }),
    search: css({
      fontSize: theme.typography.fontSize,
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
      border: 'none',
      color: theme.components.input.text,
    }),
    spinner: css({
      height: '22px',
    }),
    resultsContainer: css({
      paddingBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      padding: theme.spacing(1.5, 2, 2, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      marginTop: theme.spacing(1),
    }),
    sectionHeaderFirst: css({
      paddingBottom: theme.spacing(1),
      borderTop: 'none',
      marginTop: 0,
    }),
  };
};
