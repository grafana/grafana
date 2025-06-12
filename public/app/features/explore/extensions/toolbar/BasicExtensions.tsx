import { lazy, Suspense } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Dropdown, ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ToolbarExtensionPointMenu } from '../ToolbarExtensionPointMenu';

import { ExtensionDropdownProps } from './types';

const AddToDashboard = lazy(() =>
  import('./../AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard }))
);

export function BasicExtensions(props: ExtensionDropdownProps) {
  const { exploreId, links, setSelectedExtension, setIsModalOpen, isModalOpen, noQueriesInPane } = props;
  // If we only have the explore core extension point registered we show the old way of
  // adding a query to a dashboard.
  if (links.length <= 1) {
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

  const menu = <ToolbarExtensionPointMenu extensions={links} onSelect={setSelectedExtension} />;

  return (
    <>
      <Dropdown onVisibleChange={setIsModalOpen} placement="bottom-start" overlay={menu}>
        <ToolbarButton
          aria-label={t('explore.basic-extensions.aria-label-add', 'Add')}
          disabled={!Boolean(noQueriesInPane)}
          variant="canvas"
          isOpen={isModalOpen}
        >
          <Trans i18nKey="explore.toolbar.add-to-extensions">Add</Trans>
        </ToolbarButton>
      </Dropdown>
    </>
  );
}
