import React, { useState } from 'react';

import { Icon, Input, Tooltip, Collapse, Label, InlineField } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMetricResource } from '../../types';
import { Space } from '../Space';

interface ResourcePickerProps<T> {
  resources: T[];
  onChange: (resources: T[]) => void;
}

const Advanced = ({ resources, onChange }: ResourcePickerProps<string | AzureMetricResource>) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(!!resources.length && JSON.stringify(resources).includes('$'));

  const onResourceChange = (resource: string | AzureMetricResource, index: number) => {
    const newResources = [...resources];
    newResources[index] = resource;
    onChange(newResources);
  };

  return (
    <div data-testid={selectors.components.queryEditor.resourcePicker.advanced.collapse}>
      <Collapse
        collapsible
        label="Advanced"
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {(resources.length ? resources : [{}]).map((resource, index) => (
          <div key={`resource-${index + 1}`}>
            {typeof resource === 'string' ? (
              <>
                <Label htmlFor={`input-advanced-resource-picker-${index + 1}`}>
                  <h6>
                    Resource URI{' '}
                    <Tooltip
                      content={
                        <>
                          Manually edit the{' '}
                          <a
                            href="https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-standard-columns#_resourceid"
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            resource uri.{' '}
                          </a>
                          Supports the use of multiple template variables (ex: /subscriptions/$subId/resourceGroups/$rg)
                        </>
                      }
                      placement="right"
                      interactive={true}
                    >
                      <Icon name="info-circle" />
                    </Tooltip>
                  </h6>
                </Label>
                <Input
                  id={`input-advanced-resource-picker-${index + 1}`}
                  value={resource}
                  onChange={(event) => onResourceChange(event.currentTarget.value, index)}
                  placeholder="ex: /subscriptions/$subId"
                />
              </>
            ) : (
              <>
                <InlineField
                  label="Subscription"
                  grow
                  transparent
                  htmlFor={`input-advanced-resource-picker-subscription-${index + 1}`}
                  labelWidth={15}
                  data-testid={selectors.components.queryEditor.resourcePicker.advanced.subscription.input}
                >
                  <Input
                    id={`input-advanced-resource-picker-subscription-${index + 1}`}
                    value={resource?.subscription ?? ''}
                    onChange={(event) =>
                      onResourceChange({ ...resource, subscription: event.currentTarget.value }, index)
                    }
                    placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeee"
                  />
                </InlineField>
                <InlineField
                  label="Resource Group"
                  grow
                  transparent
                  htmlFor={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
                  labelWidth={15}
                  data-testid={selectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input}
                >
                  <Input
                    id={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
                    value={resource?.resourceGroup ?? ''}
                    onChange={(event) =>
                      onResourceChange({ ...resource, resourceGroup: event.currentTarget.value }, index)
                    }
                    placeholder="resource-group"
                  />
                </InlineField>
                <InlineField
                  label="Namespace"
                  grow
                  transparent
                  htmlFor={`input-advanced-resource-picker-metricNamespace-${index + 1}`}
                  labelWidth={15}
                  data-testid={selectors.components.queryEditor.resourcePicker.advanced.namespace.input}
                >
                  <Input
                    id={`input-advanced-resource-picker-metricNamespace-${index + 1}`}
                    value={resource?.metricNamespace ?? ''}
                    onChange={(event) =>
                      onResourceChange({ ...resource, metricNamespace: event.currentTarget.value }, index)
                    }
                    placeholder="Microsoft.Insights/metricNamespaces"
                  />
                </InlineField>
                <InlineField
                  label="Resource Name"
                  grow
                  transparent
                  htmlFor={`input-advanced-resource-picker-resourceName-${index + 1}`}
                  labelWidth={15}
                  data-testid={selectors.components.queryEditor.resourcePicker.advanced.resource.input}
                >
                  <Input
                    id={`input-advanced-resource-picker-resourceName-${index + 1}`}
                    value={resource?.resourceName ?? ''}
                    onChange={(event) =>
                      onResourceChange({ ...resource, resourceName: event.currentTarget.value }, index)
                    }
                    placeholder="name"
                  />
                </InlineField>
              </>
            )}
          </div>
        ))}
        <Space v={2} />
      </Collapse>
    </div>
  );
};

export default Advanced;
