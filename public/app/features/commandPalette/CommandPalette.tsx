import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
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
import React, { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction, locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types';

import { ResultItem } from './ResultItem';
import getDashboardNavActions from './actions/dashboard.nav.actions';
import getGlobalActions from './actions/global.static.actions';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */

export const CommandPalette = () => {
  const styles = useStyles2(getSearchStyles);
  const [actions, setActions] = useState<Action[]>([]);
  const [staticActions, setStaticActions] = useState<Action[]>([]);
  const { query, showing } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
  }));
  const isNotLogin = locationService.getLocation().pathname !== '/login';

  const { navBarTree } = useSelector((state) => {
    return {
      navBarTree: state.navBarTree,
    };
  });

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: showing, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  useEffect(() => {
    if (isNotLogin) {
      const staticActionsResp = getGlobalActions(navBarTree);
      setStaticActions(staticActionsResp);
      setActions([...staticActionsResp]);
    }
  }, [isNotLogin, navBarTree]);

  useEffect(() => {
    if (showing) {
      reportInteraction('command_palette_opened');

      // Do dashboard search on demand
      getDashboardNavActions('go/dashboard').then((dashAct) => {
        setActions([...staticActions, ...dashAct]);
      });
    }
  }, [showing, staticActions]);

  useRegisterActions(actions, [actions]);

  return actions.length > 0 ? (
    <KBarPortal>
      <KBarPositioner className={styles.positioner}>
        <KBarAnimator className={styles.animator}>
          <FocusScope contain autoFocus restoreFocus>
            <div {...overlayProps} {...dialogProps}>
              <KBarSearch className={styles.search} />
              <RenderResults />
            </div>
          </FocusScope>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  ) : null;
};

const RenderResults = () => {
  const { results, rootActionId } = useMatches();
  const styles = useStyles2(getSearchStyles);

  return (
    <div className={styles.resultsContainer}>
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
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  sectionHeader: css({
    padding: theme.spacing(1, 2),
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.body.fontWeight,
    color: theme.colors.text.secondary,
  }),
  resultsContainer: css({
    padding: theme.spacing(2, 0),
  }),
});
