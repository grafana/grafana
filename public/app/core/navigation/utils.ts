import * as H from 'history';

export function shouldReloadPage(location: H.Location<any>) {
  return !!location.state?.forceRouteReload;
}
