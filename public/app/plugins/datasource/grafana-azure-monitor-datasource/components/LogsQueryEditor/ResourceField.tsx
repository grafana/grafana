import { Button, Icon, Modal } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { AzureQueryEditorFieldProps } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import { Space } from '../Space';

/*
  resources
  | join (
      resourcecontainers
        | where type == "microsoft.resources/subscriptions"
        | project SubscriptionName=name, subscriptionId
    ) on subscriptionId
  | join (
      resourcecontainers
        | where type == "microsoft.resources/subscriptions/resourcegroups"
        | project ResourceGroupName=name, resourceGroup
    ) on resourceGroup
  | where id == "/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM"
  | project id, name, SubscriptionName, ResourceGroupName
*/

interface ResourceComponents {
  subscriptionName: string;
  resourceGroupName: string;
  resourceName: string;
}

// TODO: make this an actual API call with the above ARG query
function getResourceComponents(resourceUri: string) {
  const re = /resourceGroups\/([\w-_]+)\/.+\/([\w-_]+)/;
  const match = resourceUri.match(re) || ['', 'fake-resource-group', 'fake-resource'];

  return Promise.resolve({
    subscriptionName: 'Fake subscription',
    resourceGroupName: match[1],
    resourceName: match[2],
  });
}

const ResourceField: React.FC<AzureQueryEditorFieldProps> = ({ query }) => {
  const [resourceComponents, setResourceComponents] = useState<ResourceComponents | undefined>(undefined);
  const [pickerIsOpen, setPickerIsOpen] = useState(false);
  const { resource } = query.azureLogAnalytics;

  useEffect(() => {
    if (resource) {
      getResourceComponents(resource).then(setResourceComponents);
    } else {
      setResourceComponents(undefined);
    }
  }, [resource]);

  const handleOpenPicker = useCallback(() => {
    setPickerIsOpen(true);
  }, []);

  const handleClosePicker = useCallback(() => {
    setPickerIsOpen(false);
  }, []);

  return (
    <>
      <Modal title="Select a resource" isOpen={pickerIsOpen} onDismiss={handleClosePicker}>
        <ResourcePicker />
      </Modal>

      <Field label="Resource">
        <Button variant="secondary" onClick={handleOpenPicker}>
          {resource ? (
            resourceComponents ? (
              <FormattedResource resource={resourceComponents} />
            ) : (
              resource
            )
          ) : (
            'Select a resource'
          )}
        </Button>
      </Field>
    </>
  );
};

interface FormattedResourceProps {
  resource: ResourceComponents;
}

const FormattedResource: React.FC<FormattedResourceProps> = ({ resource }) => {
  return (
    <span>
      <Icon name="layer-group" /> {resource.subscriptionName}
      <Separator />
      <Icon name="folder" /> {resource.resourceGroupName}
      <Separator />
      <Icon name="cube" /> {resource.resourceName}
    </span>
  );
};

const Separator = () => (
  <>
    <Space layout="inline" h={2} />
    {'/'}
    <Space layout="inline" h={2} />
  </>
);

export default ResourceField;
