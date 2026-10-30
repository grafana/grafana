import { parse } from 'semver';

import { getTextDataUsage } from './dataUsage';
import { type Options } from './panelcfg.gen';

/** Run before constructing a query runner, since plugin option migrations cannot update its queries. */
export function shouldClearTextQueries(pluginVersion: string | undefined, options: Partial<Options>): boolean {
  const version = parse(pluginVersion ?? '');
  if (version) {
    if (version.major < 13 || (version.major === 13 && version.minor < 3)) {
      return true;
    }
    if (version.major > 13 || version.minor >= 4) {
      return false;
    }
  }

  const usage = getTextDataUsage(options);
  return !usage.dataMacros && !usage.perRow && usage.dataBoundHandlebars === false;
}
