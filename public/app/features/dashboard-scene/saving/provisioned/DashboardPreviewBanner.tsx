import { Alert, Icon, Stack } from '@grafana/ui';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { useGetRepositoryFilesWithPathQuery, useGetRepositoryQuery } from 'app/features/provisioning/api';
import { usePullRequestParam } from 'app/features/provisioning/hooks';
import { DashboardRoutes } from 'app/types';

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  slug?: string;
  path?: string;
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  if ('kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }
  const prParam = usePullRequestParam(); // pull_request_url
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });

  // Required to create the new PR link
  // TODO?? can the relevant links be in the file response???
  const repo = useGetRepositoryQuery({ name: slug });

  if (file.data?.errors) {
    return <Alert title="error loading" severity="error" />;
  }

  console.log('BANNER', { queryParams, file: file.data, repo: repo.data });

  // This page was loaded with a `pull_request_url` in the URL
  // This is typically from an external link in a rendered pull request
  if (prParam?.length) {
    return (
      <Alert
        title={'This dashboard is loaded from a pull request in github.'}
        severity={'info'}
        style={{ flex: 0 }}
        buttonContent={
          <Stack alignItems={'center'}>
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
  if (queryParams.ref?.length && repo.data?.spec?.type === 'github') {
    const spec = repo.data?.spec.github!;
    const url = `${spec.url}/compare/${spec.branch}...${queryParams.ref}?quick_pull=1&labels=grafana`;

    return (
      <Alert
        title={'This dashboard is loaded from a branch in github.'}
        severity={'info'}
        style={{ flex: 0 }}
        buttonContent={
          <Stack alignItems={'center'}>
            <span>Open pull request in GitHub</span>
            <Icon name="external-link-alt" />
          </Stack>
        }
        onRemove={() => window.open(url, '_blank')}
      >
        The value is <strong>not yet</strong> saved in the grafana database
      </Alert>
    );
  }

  return (
    <Alert title={'This dashboard is loaded from an external repository'} severity={'info'} style={{ flex: 0 }}>
      The value is <strong>not</strong> saved in the grafana database
    </Alert>
  );
}
