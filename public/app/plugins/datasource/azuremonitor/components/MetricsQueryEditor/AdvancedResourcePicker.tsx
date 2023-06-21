import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Input, Label, InlineField, Button, useStyles2 } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorResource } from '../../types';

export interface ResourcePickerProps<T> {
  resources: T[];
  onChange: (resources: T[]) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  resourceList: css({ display: 'flex', columnGap: theme.spacing(1), flexWrap: 'wrap', marginBottom: theme.spacing(1) }),
  resource: css({ flex: '0 0 auto' }),
  resourceLabel: css({ padding: theme.spacing(1) }),
  resourceGroupAndName: css({ display: 'flex', columnGap: theme.spacing(0.5) }),
});

const AdvancedResourcePicker = ({ resources, onChange }: ResourcePickerProps<AzureMonitorResource>) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Ensure there is at least one resource
    if (resources.length === 0) {
      onChange([{}]);
    }
  }, [resources, onChange]);

  const onResourceChange = (index: number, resource: AzureMonitorResource) => {
    const newResources = [...resources];
    newResources[index] = resource;
    onChange(newResources);
  };

  const removeResource = (index: number) => {
    const newResources = [...resources];
    newResources.splice(index, 1);
    onChange(newResources);
  };

  const addResource = () => {
    onChange(
      resources.concat({
        subscription: resources[0]?.subscription,
        metricNamespace: resources[0]?.metricNamespace,
        resourceGroup: '',
        resourceName: '',
      })
    );
  };

  const onCommonPropChange = (r: Partial<AzureMonitorResource>) => {
    onChange(resources.map((resource) => ({ ...resource, ...r })));
  };

  return (
    <>
      <InlineField
        label="Subscription"
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-subscription`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.subscription.input}
      >
        <Input
          id={`input-advanced-resource-picker-subscription`}
          value={resources[0]?.subscription ?? ''}
          onChange={(event) => onCommonPropChange({ subscription: event.currentTarget.value })}
          placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeee"
        />
      </InlineField>
      <InlineField
        label="Namespace"
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-metricNamespace`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.namespace.input}
      >
        <Input
          id={`input-advanced-resource-picker-metricNamespace`}
          value={resources[0]?.metricNamespace ?? ''}
          onChange={(event) => onCommonPropChange({ metricNamespace: event.currentTarget.value })}
          placeholder="Microsoft.Insights/metricNamespaces"
        />
      </InlineField>
      <InlineField
        label="Region"
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-region`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.region.input}
        tooltip="The code region of the resource. Optional for one resource but mandatory when selecting multiple ones."
      >
        <Input
          id={`input-advanced-resource-picker-region`}
          value={resources[0]?.region ?? ''}
          onChange={(event) => onCommonPropChange({ region: event.currentTarget.value })}
          placeholder="northeurope"
        />
      </InlineField>
      <div className={styles.resourceList}>
        {resources.map((resource, index) => (
          <div key={`resource-${index + 1}`} className={styles.resource}>
            {resources.length !== 1 && <Label className={styles.resourceLabel}>Resource {index + 1}</Label>}
            <InlineField
              label="Resource Group"
              transparent
              htmlFor={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input}
            >
              <div className={styles.resourceGroupAndName}>
                <Input
                  id={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
                  value={resource?.resourceGroup ?? ''}
                  onChange={(event) =>
                    onResourceChange(index, { ...resource, resourceGroup: event.currentTarget.value })
                  }
                  placeholder="resource-group"
                />
                <AccessoryButton
                  aria-label="remove"
                  icon="times"
                  variant="secondary"
                  onClick={() => removeResource(index)}
                  hidden={resources.length === 1}
                  data-testid={'remove-resource'}
                />
              </div>
            </InlineField>

            <InlineField
              label="Resource Name"
              transparent
              htmlFor={`input-advanced-resource-picker-resourceName-${index + 1}`}
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resource.input}
            >
              <Input
                id={`input-advanced-resource-picker-resourceName-${index + 1}`}
                value={resource?.resourceName ?? ''}
                onChange={(event) => onResourceChange(index, { ...resource, resourceName: event.currentTarget.value })}
                placeholder="name"
              />
            </InlineField>
          </div>
        ))}
      </div>
      <Button aria-label="Add" icon="plus" variant="secondary" onClick={addResource} type="button">
        Add resource
      </Button>
    </>
  );
};

export default AdvancedResourcePicker;
