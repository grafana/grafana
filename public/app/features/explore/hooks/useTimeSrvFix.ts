import { useEffect } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

/**
 * timeSrv (which is used internally) on init reads `from` and `to` param from the URL and updates itself
 * using those value regardless of what is passed to the init method.
 * The updated value is then used by Explore to get the range for each pane.
 * This means that if `from` and `to` parameters are present in the URL,
 * it would be impossible to change the time range in Explore.
 * We are only doing this on mount for 2 reasons:
 * 1: Doing it on update means we'll enter a render loop.
 * 2: when parsing time in Explore (before feeding it to timeSrv) we make sure `from` is before `to` inside
 *    each pane state in order to not trigger un URL update from timeSrv.
 */
export function useTimeSrvFix() {
  const { location } = useGrafana();

  useEffect(() => {
    const searchParams = location.getSearchObject();
    if (searchParams.from || searchParams.to) {
      location.partial({ from: undefined, to: undefined }, true);
    }
  }, [location]);
}
