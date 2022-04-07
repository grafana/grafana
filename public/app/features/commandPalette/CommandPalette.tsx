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
import getGlobalActions from './global.actions';
import getDashboardNavActions from './dashboard.nav.actions';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */

export const CommandPalette = () => {
  const [actions, setActions] = useState<Action[]>(getGlobalActions());
  //const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();

  useEffect(() => {
    const regDashboardActions = async () => {
      //const staticActions = getGlobalActions();
      const dashAct = await getDashboardNavActions();
      console.log('add dashboard actions', query);
      //setActions([...staticActions, dashAct]);
      setActions([...actions, ...dashAct]);
      return dashAct;
    };
    regDashboardActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <KBarSearch />
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
