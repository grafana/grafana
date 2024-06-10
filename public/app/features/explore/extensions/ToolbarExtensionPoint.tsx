import React, { lazy, ReactElement, Suspense, useMemo, useState } from 'react';

import { type PluginExtensionLink, PluginExtensionPoints, RawTimeRange, getTimeZone } from '@grafana/data';
import { getPluginLinkExtensions, config } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Dropdown, ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, ExplorePanelData, useSelector } from 'app/types';

import { getExploreItemSelector, isLeftPaneSelector, selectCorrelationDetails } from '../state/selectors';

import { ConfirmNavigationModal } from './ConfirmNavigationModal';
import { ToolbarExtensionPointMenu } from './ToolbarExtensionPointMenu';

const AddToDashboard = lazy(() =>
  import('./AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard }))
);

type Props = {
  exploreId: string;
  timeZone: TimeZone;
};

export function ToolbarExtensionPoint(props: Props): ReactElement | null {
  const { exploreId } = props;
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const context = useExtensionPointContext(props);
  const extensions = useExtensionLinks(context);
  const selectExploreItem = getExploreItemSelector(exploreId);
  const noQueriesInPane = useSelector(selectExploreItem)?.queries?.length;

  // If we only have the explore core extension point registered we show the old way of
  // adding a query to a dashboard.
  if (extensions.length <= 1) {
    const canAddPanelToDashboard =
      contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
      contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

    if (!canAddPanelToDashboard) {
      return null;
    }

    return (
      <Suspense fallback={null}>
        <AddToDashboard exploreId={exploreId} />
      </Suspense>
    );
  }

  const menu = <ToolbarExtensionPointMenu extensions={extensions} onSelect={setSelectedExtension} />;

  return (
    <>
      <Dropdown onVisibleChange={setIsOpen} placement="bottom-start" overlay={menu}>
        <ToolbarButton aria-label="Add" disabled={!Boolean(noQueriesInPane)} variant="canvas" isOpen={isOpen}>
          Add
        </ToolbarButton>
      </Dropdown>
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
};

function useExtensionPointContext(props: Props): PluginExtensionExploreContext {
  const { exploreId, timeZone } = props;
  const isCorrelationDetails = useSelector(selectCorrelationDetails);
  const isCorrelationsEditorMode = isCorrelationDetails?.editorMode || false;
  const { queries, queryResponse, range } = useSelector(getExploreItemSelector(exploreId))!;
  const isLeftPane = useSelector(isLeftPaneSelector(exploreId));

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
      shouldShowAddCorrelation:
        config.featureToggles.correlations === true &&
        canWriteCorrelations &&
        !isCorrelationsEditorMode &&
        isLeftPane &&
        numUniqueIds === 1,
    };
  }, [
    exploreId,
    queries,
    queryResponse,
    range.raw,
    timeZone,
    canWriteCorrelations,
    isCorrelationsEditorMode,
    isLeftPane,
    numUniqueIds,
  ]);
}

function useExtensionLinks(context: PluginExtensionExploreContext): PluginExtensionLink[] {
  return useMemo(() => {
    const { extensions } = getPluginLinkExtensions({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      context: context,
      limitPerPlugin: 3,
    });

    return extensions;
  }, [context]);
}
