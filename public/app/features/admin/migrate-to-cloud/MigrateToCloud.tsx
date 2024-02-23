import React from 'react';

import { Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetStatusQuery } from './api';

export default function MigrateToCloud() {
  const { data } = useGetStatusQuery();

  return (
    <Page navId="migrate-to-cloud">
      <Stack>
        <Text>TODO</Text>
        <pre>{JSON.stringify(data)}</pre>
      </Stack>
    </Page>
  );
}
