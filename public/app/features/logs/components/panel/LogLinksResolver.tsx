import { type ReactNode, useMemo } from 'react';

import { CoreApp, type LinkModel, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

import { useLogListContext } from './LogListContext';
import {
  buildTracesDrilldownContext,
  isExploreTempoTraceLink,
  resolveTracesDrilldownLinks,
} from './tracesDrilldownLink';

export function LogLinksResolver<T extends LinkModel>({
  links,
  children,
}: {
  links: readonly T[] | undefined;
  children: (links: readonly T[] | undefined) => ReactNode;
}) {
  const { app } = useLogListContext();
  // Drilldown (including when it is embedded) reports CoreApp.Unknown. Explore and dashboards set a known app.
  if (app !== CoreApp.Unknown || !links?.some(isExploreTempoTraceLink)) {
    return children(links);
  }
  return <ResolveTracesDrilldownLinks links={links}>{children}</ResolveTracesDrilldownLinks>;
}

function ResolveTracesDrilldownLinks<T extends LinkModel>({
  links,
  children,
}: {
  links: readonly T[];
  children: (links: readonly T[] | undefined) => ReactNode;
}) {
  const tempoLink = links.find(isExploreTempoTraceLink);
  const context = useMemo(() => (tempoLink ? buildTracesDrilldownContext(tempoLink) : undefined), [tempoLink]);
  const { links: extensionLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context,
    limitPerPlugin: 1,
  });
  const resolved = useMemo(() => resolveTracesDrilldownLinks(links, extensionLinks), [extensionLinks, links]);

  return children(resolved);
}
