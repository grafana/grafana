import { useCallback } from 'react';

import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types';

import { trackAddNewDsClicked } from '../tracking';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const handleClick = useCallback(() => {
    trackAddNewDsClicked({ path: location.pathname });
  }, []);

  return canCreateDataSource ? (
    <LinkButton icon="plus" href={config.appSubUrl + ROUTES.DataSourcesNew} onClick={handleClick}>
      <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
    </LinkButton>
  ) : null;
}
