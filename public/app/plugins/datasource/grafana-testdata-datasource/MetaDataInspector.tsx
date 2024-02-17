import React from 'react';

import { MetadataInspectorProps } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { TestData } from './dataquery.gen';
import { TestDataDataSource } from './datasource';

export type Props = MetadataInspectorProps<TestDataDataSource, TestData>;

export function MetaDataInspector({ data }: Props) {
  return (
    <Stack direction="column">
      <div>Meta data inspector for the TestData data source.</div>

      {data.map((frame, index) => (
        <>
          <div>Frame: {index}</div>
          <div>
            Custom meta: <br />
            {JSON.stringify(frame.meta?.custom, null, 2)}
          </div>
        </>
      ))}
    </Stack>
  );
}
