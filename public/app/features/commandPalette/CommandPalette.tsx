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
} from 'kbar';
import getGlobalActions from './global.actions';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */
export const CommandPalette = () => {
  /*  useEffect(() => {
    const useGetAllGlobalActionsHook = async () => {
      const actions = await getGlobalActions();
      useRegisterActions(actions);
    }
    useGetAllGlobalActionsHook();
  });*/
  console.log('render command palette');
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    const loadActions = async () => {
      const actionsResp = await getGlobalActions();
      setActions(actionsResp);
    };

    loadActions();
  }, []);

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
