import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';

import Datasource from '../../datasource';
import { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureQueryEditorFieldProps, AzureMonitorQuery, AzureResourceSummaryItem } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import getStyles from '../ResourcePicker/styles';
import { ResourceRowType } from '../ResourcePicker/types';
import { parseResourceURI } from '../ResourcePicker/utils';

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

interface ResourceFieldProps extends AzureQueryEditorFieldProps {
  setResource: (query: AzureMonitorQuery, resourceURI?: string) => AzureMonitorQuery;
  selectableEntryTypes: ResourceRowType[];
  queryType: ResourcePickerQueryType;
  resourceUri?: string;
  inlineField?: boolean;
  labelWidth?: number;
}

const ResourceField: React.FC<ResourceFieldProps> = ({
  query,
  datasource,
  onQueryChange,
  setResource,
  selectableEntryTypes,
  queryType,
  resourceUri,
  inlineField,
  labelWidth,
}) => {
  const styles = useStyles2(getStyles);
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
    [closePicker, onQueryChange, query, setResource]
  );

  return (
    <>
      <Modal
        className={styles.modal}
        title="Select a resource"
        isOpen={pickerIsOpen}
        onDismiss={closePicker}
        // The growing number of rows added to the modal causes a focus
        // error in the modal, making it impossible to click on new elements
        trapFocus={false}
      >
        <ResourcePicker
          resourcePickerData={datasource.resourcePickerData}
          resourceURI={resourceUri}
          onApply={handleApply}
          onCancel={closePicker}
          selectableEntryTypes={selectableEntryTypes}
          queryType={queryType}
        />
      </Modal>
      <Field label="Resource" inlineField={inlineField} labelWidth={labelWidth}>
        <Button className={styles.resourceFieldButton} variant="secondary" onClick={handleOpenPicker} type="button">
          <ResourceLabel resource={resourceUri} datasource={datasource} />
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
  const styles = useStyles2(getStyles);

  if (resource.resourceName) {
    return (
      <span className={cx(styles.truncated, styles.resourceField)}>
        <Icon name="cube" /> {resource.resourceName}
      </span>
    );
  }
  if (resource.resourceGroupName) {
    return (
      <span>
        <Icon name="folder" /> {resource.resourceGroupName}
      </span>
    );
  }
  return (
    <span>
      <Icon name="layer-group" /> {resource.subscriptionName}
    </span>
  );
};

export default ResourceField;
