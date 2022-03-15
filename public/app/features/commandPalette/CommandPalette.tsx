import React from 'react';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarResults,
  KBarSearch,
  useMatches,
  useRegisterActions,
} from 'kbar';

/**
 * Wrap all the components from KBar here.
 * @constructor
 */
export function CommandPalette() {
  return (
    <KBarProvider>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <ActionsHandler />
            <KBarSearch />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </KBarProvider>
  );
}

/**
 * We need to handle the actions in separate component from CommandPallete because it needs access to the KBar context
 * and so needs to be wrapped in KBarProvider.
 * @constructor
 */
function ActionsHandler() {
  // Get the actions from the service. This will rerender on any change to the actions list in the service.
  //const actions = useActions();
  // Then register them with Kbar. This also handles unregistering.
  // TODO: may have some perf implications as we re-register all the actions on any change.
  const actions = [
    {
      id: 'blog',
      name: 'Blog',
      shortcut: ['b'],
      keywords: 'writing words',
      perform: () => (window.location.pathname = 'blog'),
    },
  ];
  useRegisterActions(actions, [actions]);
  return null;
}

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
