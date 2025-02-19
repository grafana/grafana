import { Box, Stack, Text } from '@grafana/ui';

import ProgressBar from './ProgressBar';
import { useListJobQuery } from './api';

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
            <Text element="p">
              {job.status.message} // {job.status.state}
            </Text>
            <ProgressBar progress={job.status.progress} />
          </Stack>
        )}
        <pre>{JSON.stringify(job, null, ' ')}</pre>
      </Stack>
    </Box>
  );
}
