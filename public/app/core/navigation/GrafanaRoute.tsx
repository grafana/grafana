import { type JsonValue } from '@openfeature/react-sdk';
import { type Location } from 'history';
import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { matchPath, Navigate, useLocation, useParams } from 'react-router-dom-v5-compat';

import { config, locationSearchToObject, navigationLogger, reportPageview } from '@grafana/runtime';
import { useFlagGrafanaMtFallback } from '@grafana/runtime/internal';
import { ErrorBoundary, PageLoader } from '@grafana/ui';
import { updateMeticulousRecording } from 'app/core/services/meticulous';
import { isFrontendService } from 'app/core/utils/isFrontendService';

import { PageFallbackLoader } from '../components/PageLoader/PageFallbackLoader';
import { useGrafana } from '../context/GrafanaContext';
import { contextSrv } from '../services/context_srv';

import { GrafanaRouteError } from './GrafanaRouteError';
import { type GrafanaRouteComponentProps, type RouteDescriptor } from './types';

export interface Props extends Pick<GrafanaRouteComponentProps, 'route' | 'location'> {}

const useMTFallback = (location: Location) => {
  const flagValue = useFlagGrafanaMtFallback();
  const urlList = getAllowedList(flagValue);
  const isUrlAllowed: boolean = urlList?.length
    ? urlList.some((pattern) => matchPath(pattern, location.pathname) !== null)
    : true;
  const [isWaiting, setIsWaiting] = useState(!isUrlAllowed);

  useEffect(() => {
    if (isUrlAllowed) {
      setIsWaiting(false);
      return;
    }

    setIsWaiting(true);
    const timeout = setTimeout(() => setIsWaiting(false), 60_000);
    return () => clearTimeout(timeout);
  }, [isUrlAllowed, location.pathname]);

  return isWaiting;
};

const getAllowedList = (value: JsonValue): string[] | undefined => {
  if (typeof value !== 'object' || !value) {
    return;
  }
  const allowList = 'allowList' in value ? value.allowList : undefined;
  if (Array.isArray(allowList)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return allowList as string[];
  }
  return;
};

export function GrafanaRoute(props: Props) {
  const { chrome, keybindings } = useGrafana();
  const displayFallback = useMTFallback(props.location);

  chrome.setMatchedRoute(props.route);

  useLayoutEffect(() => {
    keybindings.clearAndInitGlobalBindings(props.route);
  }, [keybindings, props.route]);

  useEffect(() => {
    updateBodyClassNames(props.route);
    cleanupDOM();
    navigationLogger('GrafanaRoute', false, 'Mounted', props.route);

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
    updateMeticulousRecording(props.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.location.pathname, props.location.search, props.location.hash]);

  navigationLogger('GrafanaRoute', false, 'Rendered', props.route);

  return (
    <ErrorBoundary boundaryName="grafana-route" dependencies={[props.route]}>
      {({ error, errorInfo }) => {
        if (error) {
          return <GrafanaRouteError error={error} errorInfo={errorInfo} />;
        }

        return (
          <Suspense fallback={<PageLoader />}>
            {displayFallback ? (
              <PageFallbackLoader />
            ) : (
              <props.route.component {...props} queryParams={locationSearchToObject(props.location.search)} />
            )}
          </Suspense>
        );
      }}
    </ErrorBoundary>
  );
}

export function GrafanaRouteWrapper({ route }: Pick<Props, 'route'>) {
  const location = useLocation();
  const params = useParams();

  const allowAnonymous =
    typeof route.allowAnonymous === 'function' ? route.allowAnonymous(params) : route.allowAnonymous;

  // Perform login check in the frontend now
  if (isFrontendService()) {
    const routeRequiresSignin = !allowAnonymous && !config.anonymousEnabled;
    if (routeRequiresSignin && !contextSrv.isSignedIn) {
      contextSrv.setRedirectToUrl();

      return <Navigate replace to="/login" />;
    }
  }

  const roles = route.roles ? route.roles() : [];
  if (roles?.length) {
    if (!roles.some((r: string) => contextSrv.hasRole(r))) {
      return <Navigate replace to="/" />;
    }
  }

  return <GrafanaRoute route={route} location={location} />;
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
}
