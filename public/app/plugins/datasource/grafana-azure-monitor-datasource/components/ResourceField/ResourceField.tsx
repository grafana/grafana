import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureQueryEditorFieldProps, AzureMetricResource } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import getStyles from '../ResourcePicker/styles';
import { ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails, setResource } from '../ResourcePicker/utils';

interface ResourceFieldProps<T> extends AzureQueryEditorFieldProps {
  selectableEntryTypes: ResourceRowType[];
  queryType: ResourcePickerQueryType;
  resource: T;
  inlineField?: boolean;
  labelWidth?: number;
}

const ResourceField: React.FC<ResourceFieldProps<string | AzureMetricResource>> = ({
  query,
  datasource,
  onQueryChange,
  selectableEntryTypes,
  queryType,
  resource,
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
    (resource: string | AzureMetricResource | undefined) => {
      onQueryChange(setResource(query, resource));
      closePicker();
    },
    [closePicker, onQueryChange, query]
  );

  return (
    <span data-testid={selectors.components.queryEditor.resourcePicker.select.button}>
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
          resource={resource}
          onApply={handleApply}
          onCancel={closePicker}
          selectableEntryTypes={selectableEntryTypes}
          queryType={queryType}
        />
      </Modal>
      <Field label="Resource" inlineField={inlineField} labelWidth={labelWidth}>
        <Button className={styles.resourceFieldButton} variant="secondary" onClick={handleOpenPicker} type="button">
          <ResourceLabel resource={resource} datasource={datasource} />
        </Button>
      </Field>
    </span>
  );
};

interface ResourceLabelProps<T> {
  resource: T;
  datasource: Datasource;
}

const ResourceLabel = ({ resource, datasource }: ResourceLabelProps<string | AzureMetricResource>) => {
  const [resourceComponents, setResourceComponents] = useState(parseResourceDetails(resource ?? ''));

  useEffect(() => {
    if (resource && parseResourceDetails(resource)) {
      typeof resource === 'string'
        ? datasource.resourcePickerData.getResourceURIDisplayProperties(resource).then(setResourceComponents)
        : setResourceComponents(resource);
    } else {
      setResourceComponents({});
    }
  }, [datasource.resourcePickerData, resource]);

  if (!resource || (typeof resource === 'object' && !resource.subscription)) {
    return <>Select a resource</>;
  }

  if (resourceComponents) {
    return <FormattedResource resource={resourceComponents} />;
  }

  return <>{resource}</>;
};

interface FormattedResourceProps {
  resource: AzureMetricResource;
}

const FormattedResource = ({ resource }: FormattedResourceProps) => {
  const styles = useStyles2(getStyles);

  if (resource.resourceName) {
    return (
      <span className={cx(styles.truncated, styles.resourceField)}>
        <Icon name="cube" /> {resource.resourceName.split('/')[0]}
      </span>
    );
  }
  if (resource.resourceGroup) {
    return (
      <span>
        <Icon name="folder" /> {resource.resourceGroup}
      </span>
    );
  }
  return (
    <span>
      <Icon name="layer-group" /> {resource.subscription}
    </span>
  );
};

export default ResourceField;
