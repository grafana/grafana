import type { QueryEditorProps, SelectableValue } from '@grafana/data';
import { Stack, Select, InlineField, Switch } from '@grafana/ui';

import type DockerDatasource from '../datasource';
import type { DockerOptions, DockerQuery } from '../types';

import { ContainerSelect } from './ContainerSelect';

type Props = QueryEditorProps<DockerDatasource, DockerQuery, DockerOptions>;

const RESOURCE_TYPES: Array<SelectableValue<DockerQuery['resourceType']>> = [
  { label: 'Container Stats', value: 'container_stats' },
  { label: 'System DF', value: 'system_df' },
  { label: 'All Containers Info', value: 'all_containers_info' },
];

export function DockerQueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const update = (patch: Partial<DockerQuery>) => {
    onChange({ ...query, ...patch });
    onRunQuery();
  };

  const handleResourceTypeChange = (v: SelectableValue<DockerQuery['resourceType']>) => {
    if (v?.value) {
      update({ resourceType: v.value });
    }
  };

  return (
    <Stack direction="column" gap={1}>
      <Select
        value={RESOURCE_TYPES.find((r) => r.value === query.resourceType)}
        options={RESOURCE_TYPES}
        onChange={handleResourceTypeChange}
      />

      {query.resourceType === 'container_stats' && (
        <>
          <ContainerSelect
            value={query.containerId}
            onChange={(containerId: string) => update({ containerId })}
            loadOptions={() => datasource.getContainers()}
          />
          <InlineField label="Streaming" labelWidth={14}>
            <Switch value={query.streaming ?? false} onChange={(e) => update({ streaming: e.currentTarget.checked })} />
          </InlineField>
        </>
      )}
    </Stack>
  );
}
