import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  path?: string;
}

export function DashboardPreviewBanner({ queryParams, route, path }: DashboardPreviewBannerProps) {
  const hasPrLink = Boolean(queryParams.prLink);
  const isProvisioned = Boolean(route === DashboardRoutes.Provisioning && path);

  if ('kiosk' in queryParams || (!queryParams.isPreview && !isProvisioned)) {
    return null;
  }

  const title = getTitle({ isProvisioned, hasPR: hasPrLink });
  return (
    <Alert
      title={title}
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
      ) : null}
    </Alert>
  );
}

type Opts = {
  isProvisioned?: boolean;
  hasPR: boolean;
};
function getTitle({ isProvisioned, hasPR }: Opts) {
  if (isProvisioned) {
    return 'This dashboard is loaded from an external repository';
  }
  if (hasPR) {
    return "This dashboard is a draft. The changes aren't live yet. You can review them in GitHub.";
  }
  return 'This dashboard is a draft. The changes aren’t live yet. Submit a pull request for review.';
}
