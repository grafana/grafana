import { Stack } from '@grafana/ui';

interface Version {
  version: string;
  releaseDate: string;
  notes?: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
}

export function Overview({ versions, installedVersion }: Props) {
  return (
    <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
      <h3>Current version: {installedVersion}</h3>
      <h3> Grafana Out of date: </h3>


    </Stack>
  );
}

