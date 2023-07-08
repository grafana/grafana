import React, { lazy, ReactElement, Suspense, useMemo, useState } from 'react';

import { type PluginExtensionLink, PluginExtensionPoints, RawTimeRange } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { truncateTitle } from 'app/features/plugins/extensions/utils';
import { AccessControlAction, ExplorePanelData, useSelector } from 'app/types';

import { getExploreItemSelector } from '../state/selectors';

import { ConfirmNavigationModal } from './ConfirmNavigationModal';

const AddToDashboard = lazy(() =>
  import('./AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard }))
);

type Props = {
  exploreId: string;
  timeZone: TimeZone;
  splitted: boolean;
};

export function ToolbarExtensionPoint(props: Props): ReactElement | null {
  const { exploreId, splitted } = props;
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
      contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor) ||
      contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor);

    if (!canAddPanelToDashboard) {
      return null;
    }

    return (
      <Suspense fallback={null}>
        <AddToDashboard exploreId={exploreId} />
      </Suspense>
    );
  }

  const menu = (
    <Menu>
      {extensions.map((extension) => (
        <Menu.Item
          ariaLabel={extension.title}
          icon={extension?.icon || 'plug'}
          key={extension.id}
          label={truncateTitle(extension.title, 25)}
          onClick={(event) => {
            if (extension.path) {
              return setSelectedExtension(extension);
            }
            extension.onClick?.(event);
          }}
        />
      ))}
    </Menu>
  );

  return (
    <>
      <Dropdown onVisibleChange={setIsOpen} placement="bottom-start" overlay={menu}>
        <ToolbarButton
          aria-label="Add"
          icon="plus"
          disabled={!Boolean(noQueriesInPane)}
          variant="canvas"
          isOpen={isOpen}
        >
          {splitted ? ' ' : 'Add'}
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
};

function useExtensionPointContext(props: Props): PluginExtensionExploreContext {
  const { exploreId, timeZone } = props;
  const { queries, queryResponse, range } = useSelector(getExploreItemSelector(exploreId))!;

  return useMemo(() => {
    return {
      exploreId,
      targets: queries,
      data: queryResponse,
      timeRange: range.raw,
      timeZone: timeZone,
    };
  }, [exploreId, queries, queryResponse, range, timeZone]);
}

function useExtensionLinks(context: PluginExtensionExploreContext): PluginExtensionLink[] {
  return useMemo(() => {
    const { extensions } = getPluginLinkExtensions({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      context: context,
    });

    return extensions;
  }, [context]);
}
