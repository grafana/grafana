import { useState, ChangeEvent, useEffect } from 'react';

import { Button, Icon, Stack, Checkbox, Text, Box, IconName, Space, Tooltip } from '@grafana/ui';
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

// Manual order of resource types to display in the UI for better UX.
const alertsSubResources = [
  'ALERT_RULE',
  'NOTIFICATION_POLICY',
  'NOTIFICATION_TEMPLATE',
  'CONTACT_POINT',
  'MUTE_TIMING',
] as const;

const displayOrder = [
  'DASHBOARD',
  'LIBRARY_ELEMENT',
  'DATASOURCE',
  'PLUGIN',
  'FOLDER',
  'ALERT_RULE_GROUP',
  ...alertsSubResources,
] as const;

// This guarantees that displayOrder includes all ResourceTypeId values.
type IsExhaustive = Exclude<ResourceTypeId, (typeof displayOrder)[number]> extends never ? true : false;
const hasAllResourceTypes: IsExhaustive = true; // prettier-ignore

function resourceTypeOrder(resourceTypes: ResourceTypeId[]): ResourceTypeId[] {
  return hasAllResourceTypes && displayOrder.filter((type) => resourceTypes.includes(type));
}

export function ConfigureSnapshot(props: ConfigureSnapshotProps) {
  const { disabled, isLoading, onClick, resourceDependencies } = props;
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceTypeId>>(new Set());
  const [includeAll, setIncludeAll] = useState(true);

  const { dependencyMap, dependentMap } = buildDependencyMaps(resourceDependencies);
  const resourceTypes = resourceTypeOrder(Array.from(dependencyMap.keys()));

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
            Select which resources you want to include in the snapshot to migrate.
          </Trans>
          <br />
          <Text weight="bold">
            <Trans i18nKey="migrate-to-cloud.configure-snapshot.description-sub-line">
              Some resources may depend on others and will be automatically selected or deselected.
            </Trans>
          </Text>
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
              <Space h={alertsSubResources.includes(type as (typeof alertsSubResources)[number]) ? 2 : 0.25} />
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

        <Box display="flex" justifyContent="flex-start" alignItems="center" gap={1}>
          <Button
            disabled={disabled || selectedTypes.size === 0}
            onClick={handleBuildSnapshot}
            icon={isLoading ? 'spinner' : undefined}
            data-testid="migrate-to-cloud-configure-snapshot-build-snapshot-button"
          >
            <Trans i18nKey="migrate-to-cloud.summary.start-migration">Build snapshot</Trans>
          </Button>

          <Tooltip
            content={
              <Trans i18nKey="migrate-to-cloud.building-snapshot.description-eta">
                Creating a snapshot typically takes less than two minutes.
              </Trans>
            }
            placement="right"
            interactive={true}
          >
            <Icon name="info-circle" size="lg" />
          </Tooltip>
        </Box>
      </Stack>
    </Stack>
  );
}
