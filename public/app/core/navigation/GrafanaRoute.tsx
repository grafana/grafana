import React, { Suspense, useEffect, useLayoutEffect } from 'react';
// @ts-ignore
import Drop from 'tether-drop';

import { locationSearchToObject, navigationLogger, reportPageview } from '@grafana/runtime';
import { ErrorBoundary } from '@grafana/ui';

import { useGrafana } from '../context/GrafanaContext';

import { GrafanaRouteError } from './GrafanaRouteError';
import { GrafanaRouteLoading } from './GrafanaRouteLoading';
import { GrafanaRouteComponentProps, RouteDescriptor } from './types';

export interface Props extends Omit<GrafanaRouteComponentProps, 'queryParams'> {}

export function GrafanaRoute(props: Props) {
  const { chrome, keybindings } = useGrafana();

  chrome.setMatchedRoute(props.route);

  useLayoutEffect(() => {
    keybindings.clearAndInitGlobalBindings(props.route);
  }, [keybindings, props.route]);

  useEffect(() => {
    updateBodyClassNames(props.route);
    cleanupDOM();
    navigationLogger('GrafanaRoute', false, 'Mounted', props.match);

    return () => {
      navigationLogger('GrafanaRoute', false, 'Unmounted', props.route);
      updateBodyClassNames(props.route, true);
    };
    // props.match instance change even though only query params changed so to make this effect only trigger on route mount we have to disable exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cleanupDOM();
    reportPageview();
    navigationLogger('GrafanaRoute', false, 'Updated', props);
  });

  navigationLogger('GrafanaRoute', false, 'Rendered', props.route);

  return (
    <ErrorBoundary>
      {({ error, errorInfo }) => {
        if (error) {
          return <GrafanaRouteError error={error} errorInfo={errorInfo} />;
        }

        return (
          <Suspense fallback={<GrafanaRouteLoading />}>
            <props.route.component {...props} queryParams={locationSearchToObject(props.location.search)} />
          </Suspense>
        );
      }}
    </ErrorBoundary>
  );
}

function getPageClasses(route: RouteDescriptor) {
  return route.pageClass ? route.pageClass.split(' ') : [];
}

function updateBodyClassNames(route: RouteDescriptor, clear = false) {
  for (const cls of getPageClasses(route)) {
    if (clear) {
      document.body.classList.remove(cls);
    } else {
      document.body.classList.add(cls);
    }
  }
}

function cleanupDOM() {
  document.body.classList.remove('sidemenu-open--xs');

  // cleanup tooltips
  const tooltipById = document.getElementById('tooltip');
  tooltipById?.parentElement?.removeChild(tooltipById);

  const tooltipsByClass = document.querySelectorAll('.tooltip');
  for (let i = 0; i < tooltipsByClass.length; i++) {
    const tooltip = tooltipsByClass[i];
    tooltip.parentElement?.removeChild(tooltip);
  }

  // cleanup tether-drop
  for (const drop of Drop.drops) {
    drop.destroy();
  }
}
