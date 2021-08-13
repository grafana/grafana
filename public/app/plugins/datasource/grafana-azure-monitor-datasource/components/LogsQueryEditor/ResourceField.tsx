import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import Datasource from '../../datasource';
import { AzureQueryEditorFieldProps, AzureResourceSummaryItem } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import { parseResourceURI } from '../ResourcePicker/utils';
import { Space } from '../Space';
import { setResource } from './setQueryValue';

function parseResourceDetails(resourceURI: string) {
  const parsed = parseResourceURI(resourceURI);

  if (!parsed) {
    return undefined;
  }

  return {
    subscriptionName: parsed.subscriptionID,
    resourceGroupName: parsed.resourceGroup,
    resourceName: parsed.resource,
  };
}

const ResourceField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, onQueryChange }) => {
  const styles = useStyles2(getStyles);
  const { resource } = query.azureLogAnalytics ?? {};

  const [pickerIsOpen, setPickerIsOpen] = useState(false);

  const handleOpenPicker = useCallback(() => {
    setPickerIsOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerIsOpen(false);
  }, []);

  const handleApply = useCallback(
    (resourceURI: string | undefined) => {
      onQueryChange(setResource(query, resourceURI));
      closePicker();
    },
    [closePicker, onQueryChange, query]
  );

  const templateVariables = datasource.getVariables();

  return (
    <>
      <Modal className={styles.modal} title="Select a resource" isOpen={pickerIsOpen} onDismiss={closePicker}>
        <ResourcePicker
          resourcePickerData={datasource.resourcePickerData}
          resourceURI={resource}
          templateVariables={templateVariables}
          onApply={handleApply}
          onCancel={closePicker}
        />
      </Modal>

      <Field label="Resource">
        <Button variant="secondary" onClick={handleOpenPicker}>
          <ResourceLabel resource={resource} datasource={datasource} />
        </Button>
      </Field>
    </>
  );
};

interface ResourceLabelProps {
  resource: string | undefined;
  datasource: Datasource;
}

const ResourceLabel = ({ resource, datasource }: ResourceLabelProps) => {
  const [resourceComponents, setResourceComponents] = useState(parseResourceDetails(resource ?? ''));

  useEffect(() => {
    if (resource && parseResourceDetails(resource)) {
      datasource.resourcePickerData.getResourceURIDisplayProperties(resource).then(setResourceComponents);
    } else {
      setResourceComponents(undefined);
    }
  }, [datasource.resourcePickerData, resource]);

  if (!resource) {
    return <>Select a resource</>;
  }

  if (resourceComponents) {
    return <FormattedResource resource={resourceComponents} />;
  }

  if (resource.startsWith('$')) {
    return (
      <span>
        <Icon name="x" /> {resource}
      </span>
    );
  }

  return <>{resource}</>;
};

interface FormattedResourceProps {
  resource: AzureResourceSummaryItem;
}

const FormattedResource = ({ resource }: FormattedResourceProps) => {
  return (
    <span>
      <Icon name="layer-group" /> {resource.subscriptionName}
      {resource.resourceGroupName && (
        <>
          <Separator />
          <Icon name="folder" /> {resource.resourceGroupName}
        </>
      )}
      {resource.resourceName && (
        <>
          <Separator />
          <Icon name="cube" /> {resource.resourceName}
        </>
      )}
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
