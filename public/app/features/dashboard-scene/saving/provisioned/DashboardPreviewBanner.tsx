import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
}
export function DashboardPreviewBanner({ queryParams }: DashboardPreviewBannerProps) {
  if (!queryParams.isPreview) {
    return null;
  }

  const hasPrLink = Boolean(queryParams.prLink);
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
