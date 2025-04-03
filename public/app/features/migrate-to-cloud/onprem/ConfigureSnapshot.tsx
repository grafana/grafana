import { useState, ChangeEvent, useEffect } from 'react';

import { Button, Icon, Stack, Checkbox, Text, Box, IconName } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ResourceDependencyDto } from '../api';

import { ResourceTypeId, buildDependencyMaps, handleSelection, handleDeselection } from './resourceDependency';
import { iconNameForResource, pluralizeResourceName } from './resourceInfo';

interface ConfigureSnapshotProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: (resourceTypes: ResourceTypeId[]) => void;
  resourceDependencies: ResourceDependencyDto[] | never[];
}

export function ConfigureSnapshot(props: ConfigureSnapshotProps) {
  const { disabled, isLoading, onClick, resourceDependencies } = props;
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceTypeId>>(new Set());
  const [includeAll, setIncludeAll] = useState(true);

  const { dependencyMap, dependentMap } = buildDependencyMaps(resourceDependencies);
  const resourceTypes = Array.from(dependencyMap.keys()).sort();

  // Initialize with all items selected when component mounts once.
  useEffect(() => {
    setSelectedTypes(new Set(resourceTypes));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIncludeAllChange = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;

    setIncludeAll(checked);
    if (checked) {
      // When directly checking include all, select all other items as well.
      setSelectedTypes(new Set(resourceTypes));
    } else {
      // When directly unchecking include all, clear all other items as well.
      setSelectedTypes(new Set());
    }
  };

  const handleTypeChange = (id: ResourceTypeId) => (e: ChangeEvent<HTMLInputElement>) => {
    const updatedList = e.target.checked
      ? handleSelection(dependencyMap, selectedTypes, id)
      : handleDeselection(dependentMap, selectedTypes, id);

    setSelectedTypes(updatedList);
    setIncludeAll(updatedList.size === resourceTypes.length);
  };

  const handleBuildSnapshot = () => {
    onClick(Array.from(selectedTypes));
  };

  return (
    <Stack direction="column" gap={3}>
      <Stack direction="column" gap={1}>
        <Text variant="h4">
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="cog" size="lg" />
            <Trans i18nKey="migrate-to-cloud.configure-snapshot.title">Configure snapshot</Trans>
          </Stack>
        </Text>
        <Text color="secondary">
          <Trans i18nKey="migrate-to-cloud.configure-snapshot.description">
            Select which resources you want to include in the snapshot. Some resources may depend on others and will be
            automatically selected or deselected.
          </Trans>
        </Text>
      </Stack>

      <Stack direction="column" gap={2} alignItems="flex-start">
        <Stack direction="column" gap={1} alignItems="flex-start">
          <Stack key="include-all" alignItems="flex-start">
            <Checkbox
              indeterminate={selectedTypes.size > 0 && !includeAll}
              value={includeAll}
              onChange={handleIncludeAllChange}
              data-testid="migrate-to-cloud-configure-snapshot-checkbox-resource-include-all"
              //@ts-ignore
              label={
                <Text variant="h5">
                  <Trans i18nKey="migrate-to-cloud.configure-snapshot.resource-include-all">Include all</Trans>
                </Text>
              }
            />
          </Stack>

          {resourceTypes.map((type) => (
            <Stack key={type} gap={1} alignItems="center">
              <Checkbox
                value={selectedTypes.has(type)}
                onChange={handleTypeChange(type)}
                data-testid={`migrate-to-cloud-configure-snapshot-checkbox-resource-${type.toLowerCase()}`}
                //@ts-ignore
                label={
                  <Stack gap={1} alignItems="center">
                    <Icon name={iconNameForResource(type) as IconName} size="xl" />
                    <Text variant="h5">{pluralizeResourceName(type) ?? type}</Text>
                  </Stack>
                }
              />
            </Stack>
          ))}
        </Stack>

        <Box display="flex" justifyContent="flex-start">
          <Button
            disabled={disabled || selectedTypes.size === 0}
            onClick={handleBuildSnapshot}
            icon={isLoading ? 'spinner' : undefined}
            data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"
          >
            <Trans i18nKey="migrate-to-cloud.summary.start-migration">Build snapshot</Trans>
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
