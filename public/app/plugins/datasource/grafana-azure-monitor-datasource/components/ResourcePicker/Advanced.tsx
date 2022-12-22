import React, { useState } from 'react';

import { Icon, Input, Tooltip, Collapse, Label, InlineField } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMetricResource } from '../../types';
import { Space } from '../Space';

interface ResourcePickerProps<T> {
  resource: T;
  onChange: (resource: T) => void;
}

const Advanced = ({ resource, onChange }: ResourcePickerProps<string | AzureMetricResource>) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(!!resource && JSON.stringify(resource).includes('$'));

  return (
    <div data-testid={selectors.components.queryEditor.resourcePicker.advanced.collapse}>
      <Collapse
        collapsible
        label="Advanced"
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {typeof resource === 'string' ? (
          <>
            {' '}
            <Label htmlFor="input-advanced-resource-picker">
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
              id="input-advanced-resource-picker"
              value={resource}
              onChange={(event) => onChange(event.currentTarget.value)}
              placeholder="ex: /subscriptions/$subId"
            />
          </>
        ) : (
          <>
            <InlineField
              label="Subscription"
              grow
              transparent
              htmlFor="input-advanced-resource-picker-subscription"
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.subscription.input}
            >
              <Input
                id="input-advanced-resource-picker-subscription"
                value={resource?.subscription ?? ''}
                onChange={(event) => onChange({ ...resource, subscription: event.currentTarget.value })}
                placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeee"
              />
            </InlineField>
            <InlineField
              label="Resource Group"
              grow
              transparent
              htmlFor="input-advanced-resource-picker-resourceGroup"
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input}
            >
              <Input
                id="input-advanced-resource-picker-resourceGroup"
                value={resource?.resourceGroup ?? ''}
                onChange={(event) => onChange({ ...resource, resourceGroup: event.currentTarget.value })}
                placeholder="resource-group"
              />
            </InlineField>
            <InlineField
              label="Namespace"
              grow
              transparent
              htmlFor="input-advanced-resource-picker-metricNamespace"
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.namespace.input}
            >
              <Input
                id="input-advanced-resource-picker-metricNamespace"
                value={resource?.metricNamespace ?? ''}
                onChange={(event) => onChange({ ...resource, metricNamespace: event.currentTarget.value })}
                placeholder="Microsoft.Insights/metricNamespaces"
              />
            </InlineField>
            <InlineField
              label="Resource Name"
              grow
              transparent
              htmlFor="input-advanced-resource-picker-resourceName"
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resource.input}
            >
              <Input
                id="input-advanced-resource-picker-resourceName"
                value={resource?.resourceName ?? ''}
                onChange={(event) => onChange({ ...resource, resourceName: event.currentTarget.value })}
                placeholder="name"
              />
            </InlineField>
          </>
        )}
        <Space v={2} />
      </Collapse>
    </div>
  );
};

export default Advanced;
