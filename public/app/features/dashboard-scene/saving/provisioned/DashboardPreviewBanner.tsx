import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  path?: string;
}

export function DashboardPreviewBanner({ queryParams, route, path }: DashboardPreviewBannerProps) {
  if ('kiosk' in queryParams || !queryParams.isPreview) {
    return null;
  }

  const hasPrLink = Boolean(queryParams.prLink);
  const isProvisioned = route === DashboardRoutes.Provisioning && path;

  return (
    <Alert
      title={isProvisioned ? 'This dashboard is loaded from an external repository' : 'Dashboard preview'}
      severity={isProvisioned ? 'info' : 'success'}
      style={{ flex: 0 }}
      buttonContent={
        hasPrLink && (
          <Stack alignItems={'center'}>
            <span>{isProvisioned ? 'View' : 'Open'} pull request in GitHub</span>
            <Icon name="external-link-alt" />
          </Stack>
        )
      }
      onRemove={hasPrLink ? () => window.open(queryParams.prLink, '_blank') : undefined}
    >
      {isProvisioned ? (
        <>
          The value is <strong>not</strong> saved in the grafana database.
        </>
      ) : (
        queryParams.prLink && <>Branch successfully created.</>
      )}
    </Alert>
  );
}
