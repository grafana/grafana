import { useState, ChangeEvent } from 'react';

import { Button, Icon, IconName, Stack, Checkbox, Text, Box } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ResourceDependencyDto } from '../api';

import { ResourceTableItem } from './types';

type ResourceTypeId = ResourceTableItem['type'];

interface ConfigureSnapshotProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: (resourceTypes: ResourceTypeId[]) => void;
  resourceDependencies: ResourceDependencyDto[] | never[];
}

interface ResourceType {
  id: ResourceTypeId;
  name: string;
  icon: IconName;
}

const RESOURCE_TYPES: ResourceType[] = [
  { id: 'FOLDER', name: 'Folders', icon: 'folder' },
  { id: 'DASHBOARD', name: 'Dashboards', icon: 'dashboard' },
  { id: 'DATASOURCE', name: 'Data Sources', icon: 'database' },
  { id: 'LIBRARY_ELEMENT', name: 'Library Elements', icon: 'library-panel' },
  { id: 'ALERT_RULE', name: 'Alert Rules', icon: 'bell' },
  { id: 'ALERT_RULE_GROUP', name: 'Alert Rule Groups', icon: 'bell' },
  { id: 'CONTACT_POINT', name: 'Contact Points', icon: 'at' },
  { id: 'NOTIFICATION_POLICY', name: 'Notification Policies', icon: 'comment-alt' },
  { id: 'NOTIFICATION_TEMPLATE', name: 'Notification Templates', icon: 'file-alt' },
  { id: 'MUTE_TIMING', name: 'Mute Timings', icon: 'clock-nine' },
  { id: 'PLUGIN', name: 'Plugins', icon: 'plug' },
];

function buildDependencyMaps(resourceDependencies: ResourceDependencyDto[]) {
  const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>();
  const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>();

  for (const dependency of resourceDependencies) {
    const resourceType = dependency.resourceType as ResourceTypeId;
    const dependencies = (dependency.dependencies || []) as ResourceTypeId[];

    dependencyMap.set(resourceType, dependencies);

    // Build reverse mapping (what depends on what)
    for (const dep of dependencies) {
      if (!dependentMap.has(dep)) {
        dependentMap.set(dep, []);
      }

      dependentMap.get(dep)?.push(resourceType);
    }
  }

  return { dependencyMap, dependentMap };
}

function handleSelection(
  dependencyMap: Map<ResourceTypeId, ResourceTypeId[]>,
  selectedTypes: Set<ResourceTypeId>,
  resourceToSelect: ResourceTypeId
): Set<ResourceTypeId> {
  const result = new Set(selectedTypes);

  function selectWithDependencies(resourceType: ResourceTypeId, visited: Set<ResourceTypeId>) {
    if (visited.has(resourceType)) {
      return;
    }

    visited.add(resourceType);
    result.add(resourceType);

    dependencyMap.get(resourceType)?.forEach((dep) => selectWithDependencies(dep, visited));
  }

  selectWithDependencies(resourceToSelect, new Set());

  return result;
}

function handleDeselection(
  dependentMap: Map<ResourceTypeId, ResourceTypeId[]>,
  selectedTypes: Set<ResourceTypeId>,
  resourceToDeselect: ResourceTypeId
): Set<ResourceTypeId> {
  const result = new Set(selectedTypes);

  function processDeselection(resourceType: ResourceTypeId, visited: Set<ResourceTypeId>) {
    if (visited.has(resourceType)) {
      return;
    }

    visited.add(resourceType);
    result.delete(resourceType);

    dependentMap.get(resourceType)?.forEach((dep) => processDeselection(dep, visited));
  }

  processDeselection(resourceToDeselect, new Set());

  return result;
}

export function ConfigureSnapshot(props: ConfigureSnapshotProps) {
  const { disabled, isLoading, onClick, resourceDependencies } = props;
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceTypeId>>(new Set());
  const [includeAll, setIncludeAll] = useState(false);

  const { dependencyMap, dependentMap } = buildDependencyMaps(resourceDependencies);

  const handleIncludeAllChange = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;

    setIncludeAll(checked);
    if (checked) {
      // When directly checking include all, select all other items as well.
      setSelectedTypes(new Set(RESOURCE_TYPES.map((t) => t.id)));
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
    setIncludeAll(updatedList.size === RESOURCE_TYPES.length);
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
              //@ts-ignore
              label={
                <Text variant="h5">
                  <Trans i18nKey="migrate-to-cloud.configure-snapshot.resource-include-all">Include all</Trans>
                </Text>
              }
            />
          </Stack>

          {RESOURCE_TYPES.map((type) => (
            <Stack key={type.id} gap={1} alignItems="center">
              <Checkbox
                value={selectedTypes.has(type.id)}
                onChange={handleTypeChange(type.id)}
                //@ts-ignore
                label={
                  <Stack gap={1} alignItems="center">
                    <Icon name={type.icon} size="xl" />
                    <Text variant="h5">{type.name}</Text>
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
          >
            <Trans i18nKey="migrate-to-cloud.summary.start-migration">Build snapshot</Trans>
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
