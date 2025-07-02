import { Stack } from '@grafana/ui';

interface Version {
  startingVersion: string;
  version: string;
  releaseDate: string;
  notes?: string;
  isOutOfSupport: boolean;
  type: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
}

export function Overview({ versions, installedVersion }: Props) {
  return (
    <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
      <h3>Current version: {installedVersion}</h3>
      {versions.map((v) => {
        return (
          <h3>
            {v.type} available: {v.version}
          </h3>
        );
      })}
    </Stack>
  );
}
