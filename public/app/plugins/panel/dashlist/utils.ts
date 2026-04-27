import type { PanelProps } from '@grafana/data/types';
import { DataLinkBuiltInVars, urlUtil } from '@grafana/data/utils';

import { appEvents } from '../../../core/app_events';
import { useBusEvent } from '../../../core/hooks/useBusEvent';
import { VariablesChanged } from '../../../features/variables/types';

import { type Options } from './panelcfg.gen';

export function useDashListUrlParams(props: PanelProps<Options>) {
  // We don't care about the payload just want to get re-render when this event is published
  useBusEvent(appEvents, VariablesChanged);

  let query = '';

  if (props.options.keepTime) {
    query = urlUtil.appendQueryToUrl(query, `\$${DataLinkBuiltInVars.keepTime}`);
  }

  if (props.options.includeVars) {
    query = urlUtil.appendQueryToUrl(query, `\$${DataLinkBuiltInVars.includeVars}`);
  }

  return props.replaceVariables(query);
}
