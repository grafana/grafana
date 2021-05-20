import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { AzureQueryEditorFieldProps, AzureResourceSummaryItem } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import { parseResourceURI } from '../ResourcePicker/utils';
import { Space } from '../Space';

function parseResourceDetails(resourceURI: string) {
  const parsed = parseResourceURI(resourceURI);

  if (!parsed) {
    return undefined;
  }

  return {
    id: resourceURI,
    subscriptionName: parsed.subscriptionID,
    resourceGroupName: parsed.resourceGroup,
    name: parsed.resource,
  };
}

const ResourceField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, onQueryChange }) => {
  const styles = useStyles2(getStyles);
  const { resource } = query.azureLogAnalytics;

  const [resourceComponents, setResourceComponents] = useState(parseResourceDetails(resource ?? ''));
  const [pickerIsOpen, setPickerIsOpen] = useState(false);

  useEffect(() => {
    if (resource && parseResourceDetails(resource)) {
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
      <Modal className={styles.modal} title="Select a resource" isOpen={pickerIsOpen} onDismiss={closePicker}>
        <ResourcePicker
          resourcePickerData={datasource.resourcePickerData}
          resourceURI={query.azureLogAnalytics.resource!}
          onApply={handleApply}
          onCancel={closePicker}
        />
      </Modal>

      <Field label="Resource">
        <Button variant="secondary" onClick={handleOpenPicker}>
          {/* Three mutually exclusive states */}
          {!resource && 'Select a resource'}
          {resource && resourceComponents && <FormattedResource resource={resourceComponents} />}
          {resource && !resourceComponents && resource}
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

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: theme.breakpoints.values.lg,
  }),
});
