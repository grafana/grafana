import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  slug?: string;
  path?: string;
}
export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  console.log('DashboardScenePage X', { queryParams, route, slug, path });

  // Do not show a banner when rendering the previews
  if ('kiosk' in queryParams) {
    return null;
  }
  const hasPrLink = Boolean(queryParams.prLink);

  if (route === DashboardRoutes.Provisioning && path) {
    return (
      <Alert
        title={'This dashboard is loaded from an external repository'}
        severity={'info'}
        style={{ flex: 0 }}
        buttonContent={
          hasPrLink && (
            <Stack alignItems={'center'}>
              <span>View pull request in GitHub</span>
              <Icon name="external-link-alt" />
            </Stack>
          )
        }
        onRemove={
          hasPrLink
            ? () => {
                window.open(queryParams.prLink, '_blank');
              }
            : undefined
        }
      >
        The value is <b>not</b> saved in the grafana database.
      </Alert>
    );
  }

  if (!queryParams.isPreview) {
    return null;
  }

  return (
    <Alert
      title={'Dashboard preview'}
      severity={'success'}
      style={{ flex: 0 }}
      buttonContent={
        hasPrLink && (
          <Stack alignItems={'center'}>
            <span>Open pull request in GitHub</span>
            <Icon name="external-link-alt" />
          </Stack>
        )
      }
      onRemove={
        hasPrLink
          ? () => {
              window.open(queryParams.prLink, '_blank');
            }
          : undefined
      }
    >
      {queryParams.prLink && <>Branch successfully created.</>}
    </Alert>
  );
}
