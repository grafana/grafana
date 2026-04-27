import type { MetadataInspectorProps } from '@grafana/data/types';
import { Stack } from '@grafana/ui';

import { type TestDataDataQuery } from './dataquery';
import { type TestDataDataSource } from './datasource';

export type Props = MetadataInspectorProps<TestDataDataSource, TestDataDataQuery>;

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
