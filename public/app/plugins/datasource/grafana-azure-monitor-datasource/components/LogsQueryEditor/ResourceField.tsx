import { Button, Icon, Modal } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { AzureQueryEditorFieldProps, AzureResourceSummaryItem } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import { Space } from '../Space';

function parseResourceDetails(resourceURI: string) {
  const re = /subscriptions\/([\w-]+)\/resourceGroups\/([\w-_]+)\/.+\/([\w-_]+)/;
  const match = resourceURI.match(re);

  if (!match) {
    return undefined;
  }

  return {
    id: resourceURI,
    subscriptionName: match[1],
    resourceGroupName: match[2],
    name: match[3],
  };
}

const ResourceField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, onQueryChange }) => {
  const { resource } = query.azureLogAnalytics;

  const [resourceComponents, setResourceComponents] = useState(parseResourceDetails(resource ?? ''));
  const [pickerIsOpen, setPickerIsOpen] = useState(false);

  useEffect(() => {
    if (resource) {
      datasource.resourcePickerData.getResource(resource).then(setResourceComponents);
    } else {
      setResourceComponents(undefined);
    }
  }, [datasource.resourcePickerData, resource]);

  const handleOpenPicker = useCallback(() => {
    setPickerIsOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerIsOpen(false);
  }, []);

  const handleApply = useCallback(
    (resourceURI: string | undefined) => {
      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          resource: resourceURI,
        },
      });
      closePicker();
    },
    [closePicker, onQueryChange, query]
  );

  return (
    <>
      <Modal title="Select a resource" isOpen={pickerIsOpen} onDismiss={closePicker}>
        <ResourcePicker
          resourcePickerData={datasource.resourcePickerData}
          resourceURI={query.azureLogAnalytics.resource!}
          onApply={handleApply}
          onCancel={closePicker}
        />
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
  resource: AzureResourceSummaryItem;
}

const FormattedResource: React.FC<FormattedResourceProps> = ({ resource }) => {
  return (
    <span>
      <Icon name="layer-group" /> {resource.subscriptionName}
      <Separator />
      <Icon name="folder" /> {resource.resourceGroupName}
      <Separator />
      <Icon name="cube" /> {resource.name}
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
