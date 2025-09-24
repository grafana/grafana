import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, ButtonVariant } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types/accessControl';

interface AddNewDataSourceButtonProps {
  onClick?: () => void;
  variant?: ButtonVariant;
}

export function AddNewDataSourceButton({ variant, onClick }: AddNewDataSourceButtonProps) {
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const newDataSourceURL = locationUtil.assureBaseUrl(CONNECTIONS_ROUTES.DataSourcesNew);

  return (
    <LinkButton
      variant={variant || 'primary'}
      href={newDataSourceURL}
      disabled={!hasCreateRights}
      tooltip={
        !hasCreateRights
          ? t(
              'datasources.add-new-data-source-button.tooltip-no-permission',
              'You do not have permission to configure new data sources'
            )
          : undefined
      }
      onClick={onClick}
      target="_blank"
    >
      <Trans i18nKey="data-source-picker.add-new-data-source">Configure a new data source</Trans>
    </LinkButton>
  );
}
