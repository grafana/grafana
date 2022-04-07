import React, { useEffect, useState } from 'react';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarResults,
  KBarSearch,
  useMatches,
  Action,
  VisualState,
  useRegisterActions,
  useKBar,
} from 'kbar';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { ResultItem } from './ResultItem';
import getGlobalActions from './actions/global.static.actions';
import getDashboardNavActions from './actions/dashboard.nav.actions';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';
import { css } from '@emotion/css';
import { keybindingSrv } from '../../core/services/keybindingSrv';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */

export const CommandPalette = () => {
  const styles = useStyles2(getSearchStyles);
  const [actions, setActions] = useState<Action[]>([]);
  const { showing, query } = useKBar((state) => ({
    showing: state.visualState !== VisualState.hidden,
  }));

  const { navBarTree } = useSelector((state: StoreState) => {
    return {
      navBarTree: state.navBarTree,
    };
  });

  keybindingSrv.bind('esc', () => {
    if (showing) {
      query.setVisualState(VisualState.animatingOut);
    }
  });

  useEffect(() => {
    const setGlobalActions = async () => {
      const staticActions = getGlobalActions(navBarTree);
      const dashAct = await getDashboardNavActions('go/dashboard');
      setActions([...staticActions, ...dashAct]);
    };
    setGlobalActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return (
    <>
      <div className={styles.backdrop} />
      <KBarPortal>
        <KBarPositioner className={styles.positioner}>
          <KBarAnimator className={styles.animator}>
            <KBarSearch className={styles.search} />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </>
  );
};

const RenderResults = () => {
  const { results, rootActionId } = useMatches();
  const styles = useStyles2(getSearchStyles);

  return (
    <div style={{ padding: `8px 0` }}>
      <KBarResults
        items={results}
        onRender={({ item, active }) =>
          typeof item === 'string' ? (
            <div className={styles.sectionHeader}>{item}</div>
          ) : (
            <ResultItem action={item} active={active} currentRootActionId={rootActionId!} />
          )
        }
      />
    </div>
  );
};

const getSearchStyles = (theme: GrafanaTheme2) => ({
  positioner: css({
    zIndex: theme.zIndex.portal,
    marginTop: '0px',
  }),
  backdrop: css({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    background: theme.colors.background.canvas,
    opacity: '0.7',
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
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  sectionHeader: css({
    padding: theme.spacing(1, 2),
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.body.fontWeight,
    color: theme.colors.text.secondary,
  }),
});
