import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { useGetRepositoryFilesWithPathQuery } from 'app/features/provisioning/api';
import { usePullRequestParam } from 'app/features/provisioning/hooks';
import { DashboardRoutes } from 'app/types';

interface CommonBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  path?: string;
  slug?: string;
}

interface DashboardPreviewBannerProps extends CommonBannerProps {
  route?: string;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {}

const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

function DashboardPreviewBannerContent({ queryParams, slug, path }: DashboardPreviewBannerContentProps) {
  const prParam = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });

  if (file.data?.errors) {
    return (
      <Alert title="Error loading dashboard" severity="error" style={{ flex: 0 }}>
        {file.data.errors.map((error, index) => (
          <div key={index}>{error}</div>
        ))}
      </Alert>
    );
  }

  // This page was loaded with a `pull_request_url` in the URL
  if (prParam?.length) {
    return (
      <Alert
        {...commonAlertProps}
        title="This dashboard is loaded from a pull request in GitHub."
        buttonContent={
          <Stack alignItems="center">
            <span>View pull request in GitHub</span>
            <Icon name="external-link-alt" />
          </Stack>
        }
        onRemove={() => window.open(prParam, '_blank')}
      >
        The value is <strong>not yet</strong> saved in the grafana database
      </Alert>
    );
  }

  // Check if this is a github link
  const githubURL = file.data?.urls?.newPullRequestURL ?? file.data?.urls?.compareURL;
  if (githubURL) {
    return (
      <Alert
        {...commonAlertProps}
        title="This dashboard is loaded from a branch in GitHub."
        buttonContent={
          <Stack alignItems="center">
            <span>Open pull request in GitHub</span>
            <Icon name="external-link-alt" />
          </Stack>
        }
        onRemove={() => window.open(githubURL, '_blank')}
      >
        The value is <strong>not yet</strong> saved in the grafana database
      </Alert>
    );
  }

  return (
    <Alert {...commonAlertProps} title="This dashboard is loaded from an external repository">
      The value is <strong>not</strong> saved in the grafana database
    </Alert>
  );
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  if ('kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} />;
}
