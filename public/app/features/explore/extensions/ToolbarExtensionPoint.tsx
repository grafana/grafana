import { type ReactElement, useMemo, useState } from 'react';

import {
  type ExplorePanelsState,
  type PluginExtensionLink,
  PluginExtensionPoints,
  type RawTimeRange,
  getTimeZone,
} from '@grafana/data';
import { reportInteraction, usePluginLinks } from '@grafana/runtime';
import { type DataQuery, type TimeZone } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { useScratchpadOpen } from 'app/features/notebook/scratchpad/scratchpadOpen';
import { AccessControlAction } from 'app/types/accessControl';
import { type ExplorePanelData } from 'app/types/explore';
import { useSelector } from 'app/types/store';

import { getExploreItemSelector, isLeftPaneSelector, selectCorrelationDetails } from '../state/selectors';

import { ConfirmNavigationModal } from './ConfirmNavigationModal';
import { BasicExtensions } from './toolbar/BasicExtensions';
import { QuerylessAppsExtensions } from './toolbar/QuerylessAppsExtensions';

type Props = {
  exploreId: string;
  timeZone: TimeZone;
  extensionsToShow: 'queryless' | 'basic';
};

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

export function ToolbarExtensionPoint(props: Props): ReactElement | null {
  const { exploreId, extensionsToShow } = props;
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const context = useExtensionPointContext(props);
  // TODO: Pull it up to avoid calling it twice
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context: context,
    // Core's own links (dashboard, correlation, notebook, scratchpad) all count against one plugin.
    limitPerPlugin: 4,
  });
  const selectExploreItem = getExploreItemSelector(exploreId);
  const noQueriesInPane = Boolean(useSelector(selectExploreItem)?.queries?.length);

  const querylessLinks = links.filter((link) => QUERYLESS_APPS.includes(link.pluginId));
  const commonLinks = links.filter((link) => !QUERYLESS_APPS.includes(link.pluginId));

  return (
    <>
      {extensionsToShow === 'queryless' && (
        <QuerylessAppsExtensions
          links={querylessLinks}
          noQueriesInPane={noQueriesInPane}
          exploreId={exploreId}
          setSelectedExtension={(extension) => {
            setSelectedExtension(extension);
            reportInteraction('grafana_explore_queryless_app_link_clicked', {
              pluginId: extension.pluginId,
            });
          }}
          setIsModalOpen={setIsOpen}
          isModalOpen={isOpen}
        />
      )}
      {extensionsToShow === 'basic' && (
        <BasicExtensions
          links={commonLinks}
          noQueriesInPane={noQueriesInPane}
          exploreId={exploreId}
          setSelectedExtension={setSelectedExtension}
          setIsModalOpen={setIsOpen}
          isModalOpen={isOpen}
        />
      )}
      {!!selectedExtension && !!selectedExtension.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </>
  );
}

export type PluginExtensionExploreContext = {
  exploreId: string;
  targets: DataQuery[];
  data: ExplorePanelData;
  timeRange: RawTimeRange;
  timeZone: TimeZone;
  shouldShowAddCorrelation: boolean;
  panelsState?: ExplorePanelsState;
  /** Whether the scratchpad is docked. Part of the context so the toolbar's links recompute when it changes. */
  scratchpadOpen?: boolean;
};

function useExtensionPointContext(props: Props): PluginExtensionExploreContext {
  const { exploreId, timeZone } = props;
  const isCorrelationDetails = useSelector(selectCorrelationDetails);
  const isCorrelationsEditorMode = isCorrelationDetails?.editorMode || false;
  const { queries, queryResponse, range, panelsState } = useSelector(getExploreItemSelector(exploreId))!;
  const isLeftPane = useSelector(isLeftPaneSelector(exploreId));
  const scratchpadOpen = useScratchpadOpen();

  const datasourceUids = queries.map((query) => query?.datasource?.uid).filter((uid) => uid !== undefined);
  const numUniqueIds = [...new Set(datasourceUids)].length;
  const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  return useMemo(() => {
    return {
      exploreId,
      targets: queries,
      data: queryResponse,
      timeRange: range.raw,
      timeZone: getTimeZone({ timeZone }),
      shouldShowAddCorrelation: canWriteCorrelations && !isCorrelationsEditorMode && isLeftPane && numUniqueIds === 1,
      panelsState,
      scratchpadOpen,
    };
  }, [
    canWriteCorrelations,
    exploreId,
    isCorrelationsEditorMode,
    isLeftPane,
    numUniqueIds,
    panelsState,
    queries,
    queryResponse,
    range.raw,
    scratchpadOpen,
    timeZone,
  ]);
}
