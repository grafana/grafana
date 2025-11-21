import { useCallback } from 'react';

import { Pages } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { trackAddNewDsClicked } from '../tracking';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const handleClick = useCallback(() => {
    trackAddNewDsClicked({ path: window.location.pathname });
  }, []);

  return canCreateDataSource ? (
    <LinkButton
      icon="plus"
      href={config.appSubUrl + ROUTES.DataSourcesNew}
      onClick={handleClick}
      data-testid={Pages.DataSources.dataSourceAddButton}
    >
      <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
    </LinkButton>
  ) : null;
}
