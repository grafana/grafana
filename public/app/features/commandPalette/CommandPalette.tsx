import React, { useEffect, useState } from 'react';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarResults,
  KBarSearch,
  useMatches,
  Action,
  useRegisterActions,
  useKBar,
} from 'kbar';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import getGlobalActions from './actions/global.static.actions';
import getDashboardNavActions from './actions/dashboard.nav.actions';
import { css } from '@emotion/css';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */

export const CommandPalette = () => {
  const styles = useStyles2(getSearchStyles);

  const [actions, setActions] = useState<Action[]>(getGlobalActions());
  //const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();

  useEffect(() => {
    const addDashboardActions = async () => {
      //const staticActions = getGlobalActions();
      const dashAct = await getDashboardNavActions();
      console.log('add dashboard actions', query);
      //setActions([...staticActions, dashAct]);
      setActions([...actions, ...dashAct]);
      return dashAct;
    };
    addDashboardActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return (
    <KBarProvider actions={actions} options={{ enableHistory: true }}>
      <div className={styles.backdrop} />
      <KBarPortal>
        <KBarPositioner className={styles.positioner}>
          <KBarAnimator className={styles.animator}>
            <KBarSearch className={styles.search} />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </KBarProvider>
  );
};

function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div>{item}</div>
        ) : (
          <div
            style={{
              background: active ? '#eee' : 'transparent',
            }}
          >
            {item.name}
          </div>
        )
      }
    />
  );
}

const getSearchStyles = (theme: GrafanaTheme2) => ({
  positioner: css({
    zIndex: theme.zIndex.modal + 1,
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
