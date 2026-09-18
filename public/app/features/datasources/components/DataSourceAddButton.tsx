import { type JSX } from 'react';

import { Pages } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types/accessControl';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);

  return canCreateDataSource ? (
    <LinkButton
      icon="plus"
      href={config.appSubUrl + ROUTES.DataSourcesNew}
      data-testid={Pages.DataSources.dataSourceAddButton}
      onClick={() => reportInteraction('connections_datasource_list_add_datasource_clicked', {}, { silent: true })}
    >
      <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
    </LinkButton>
  ) : null;
}
