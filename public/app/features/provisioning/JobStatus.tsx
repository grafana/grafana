import { skipToken } from '@reduxjs/toolkit/query';

import { Box, ControlledCollapse, Stack, Text, TextLink } from '@grafana/ui';

import ProgressBar from './ProgressBar';
import { useGetRepositoryQuery, useListJobQuery } from './api';
import { getRemoteURL } from './utils/git';

export function JobStatus({ name }: { name: string }) {
  const jobQuery = useListJobQuery({ watch: true, fieldSelector: `metadata.name=${name}` });
  const job = jobQuery.data?.items?.[0];

  if (!job) {
    return null;
  }

  return (
    <Box paddingTop={2}>
      <Stack direction={'column'} gap={2}>
        {job.status && (
          <Stack direction="column" gap={2}>
            <Text element="p" weight="medium">
              {job.status.message ?? ''}
            </Text>
            <ProgressBar progress={job.status.progress} />

            {job.status.state === 'success' && <RepositoryLink name={job.metadata?.labels?.repository} />}
          </Stack>
        )}
        <ControlledCollapse label="View details" isOpen={false}>
          <pre>{JSON.stringify(job, null, ' ')}</pre>
        </ControlledCollapse>
      </Stack>
    </Box>
  );
}

type RepositoryLinkProps = {
  name?: string;
};

function RepositoryLink({ name }: RepositoryLinkProps) {
  const repoQuery = useGetRepositoryQuery(name ? { name } : skipToken);
  const repo = repoQuery.data;

  if (!repo || repoQuery.isLoading || repo.spec?.type !== 'github' || !repo.spec?.github?.url) {
    return null;
  }

  const href = getRemoteURL(repo);

  if (!href) {
    return null;
  }
  return (
    <Stack direction={'column'}>
      <Text>Your dashboards and folders are now in your repository.</Text>
      <TextLink external href={href}>
        View repository
      </TextLink>
    </Stack>
  );
}
