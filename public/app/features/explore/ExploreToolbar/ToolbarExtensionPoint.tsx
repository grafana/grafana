import React, { lazy, ReactElement, Suspense, useMemo, useState } from 'react';

import { PluginExtensionLink, PluginExtensionPoints, type PluginExtensionExploreContext } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { ExploreId, useSelector } from 'app/types';

import { getExploreItemSelector } from '../state/selectors';

import { ConfirmNavigationModal } from './ConfirmNavigationModal';

const AddToDashboard = lazy(() =>
  import('../AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard }))
);

type Props = {
  exploreId: ExploreId;
  splitted: boolean;
};

export function ToolbarExtensionPoint(props: Props): ReactElement {
  const { exploreId, splitted } = props;
  const [extension, setExtension] = useState<PluginExtensionLink | undefined>();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const context = useExtensionPointContext(props);
  const extensions = useExtensionLinks(context);
  const selectExploreItem = getExploreItemSelector(exploreId);
  const noQueriesInPane = useSelector(selectExploreItem)?.queries?.length;

  if (extensions.length === 0) {
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
          icon="plug"
          key={extension.id}
          label={extension.title}
          onClick={(event) => {
            if (extension.path) {
              return setExtension(extension);
            }
            extension.onClick?.(event);
          }}
        />
      ))}
    </Menu>
  );

  return (
    <Suspense fallback={null}>
      <Dropdown onVisibleChange={setIsOpen} placement="bottom-start" overlay={menu}>
        <ToolbarButton disabled={!Boolean(noQueriesInPane)} variant="canvas" icon="plus" isOpen={isOpen}>
          {splitted ? ' ' : 'Add to...'}
        </ToolbarButton>
      </Dropdown>
      {!!extension && !!extension.path && (
        <ConfirmNavigationModal
          path={extension.path}
          title={extension.title}
          onDismiss={() => setExtension(undefined)}
        />
      )}
    </Suspense>
  );
}

function useExtensionPointContext(props: Props): PluginExtensionExploreContext {
  return useMemo(() => {
    return {};
  }, []);
}

function useExtensionLinks(context: PluginExtensionExploreContext): PluginExtensionLink[] {
  return useMemo(() => {
    const { extensions } = getPluginExtensions({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      context: context,
    });

    return extensions.reduce((links: PluginExtensionLink[], extension) => {
      if (!isPluginExtensionLink(extension)) {
        return links;
      }

      if (!extension.onClick && !extension.path) {
        return links;
      }

      links.push(extension);
      return links;
    }, []);
  }, [context]);
}
