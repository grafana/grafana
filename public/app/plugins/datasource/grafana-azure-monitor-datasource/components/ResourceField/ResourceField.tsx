import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon, Modal, useStyles2, IconName } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMetricResource } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import getStyles from '../ResourcePicker/styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseMultipleResourceDetails } from '../ResourcePicker/utils';

interface ResourceFieldProps<T> {
  selectableEntryTypes: ResourceRowType[];
  resources: T[];
  inlineField?: boolean;
  labelWidth?: number;
  searchLimit: number;
  fetchInitialRows: (selected: T[]) => Promise<ResourceRowGroup>;
  fetchAndAppendNestedRow: (rows: ResourceRowGroup, parentRow: ResourceRow) => Promise<ResourceRowGroup>;
  search: (term: string) => Promise<ResourceRowGroup>;
  disableRow: (row: ResourceRow, selectedRows: ResourceRowGroup) => boolean;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
  isValid: (r: T) => boolean;
  resourceToString: (r: T) => string;
  parseResourceDetails: (r: string, location?: string) => T;
  onResourcesChange: (resources: T[]) => void;
  // This method is specific to Azure Monitor and not generic
  // but in reality is going to be the same than parseResourceDetails
  parseAzureMetricResource: (r: T) => AzureMetricResource;
}

const ResourceField = <T extends unknown>({
  selectableEntryTypes,
  resources,
  inlineField,
  labelWidth,
  searchLimit,
  disableRow,
  renderAdvanced,
  fetchInitialRows,
  fetchAndAppendNestedRow,
  isValid,
  resourceToString,
  parseResourceDetails,
  search,
  onResourcesChange,
  parseAzureMetricResource,
}: ResourceFieldProps<T>) => {
  const styles = useStyles2(getStyles);
  const [pickerIsOpen, setPickerIsOpen] = useState(false);

  const handleOpenPicker = useCallback(() => {
    setPickerIsOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerIsOpen(false);
  }, []);

  const handleApply = useCallback(
    (resources: T[]) => {
      // onQueryChange(setResources(query, queryType, resources));
      onResourcesChange(resources);
      closePicker();
    },
    [closePicker, onResourcesChange]
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
          resources={resources}
          onApply={handleApply}
          onCancel={closePicker}
          selectableEntryTypes={selectableEntryTypes}
          disableRow={disableRow}
          renderAdvanced={renderAdvanced}
          fetchInitialRows={fetchInitialRows}
          fetchAndAppendNestedRow={fetchAndAppendNestedRow}
          search={search}
          isValid={isValid}
          resourceToString={resourceToString}
          parseResourceDetails={parseResourceDetails}
          searchLimit={searchLimit}
        />
      </Modal>
      <Field label="Resource" inlineField={inlineField} labelWidth={labelWidth}>
        <Button className={styles.resourceFieldButton} variant="secondary" onClick={handleOpenPicker} type="button">
          <ResourceLabel resources={resources.map(parseAzureMetricResource)} />
        </Button>
      </Field>
    </span>
  );
};

interface ResourceLabelProps {
  resources: AzureMetricResource[];
}

const ResourceLabel = ({ resources }: ResourceLabelProps) => {
  const [resourcesComponents, setResourcesComponents] = useState(resources);

  useEffect(() => {
    setResourcesComponents(parseMultipleResourceDetails(resources));
  }, [resources]);

  if (!resources.length) {
    return <>Select a resource</>;
  }

  return <FormattedResource resources={resourcesComponents} />;
};

interface FormattedResourceProps {
  resources: AzureMetricResource[];
}

const FormattedResource = ({ resources }: FormattedResourceProps) => {
  const styles = useStyles2(getStyles);

  let icon: IconName = 'cube';
  const items: string[] = [];
  resources.forEach((resource) => {
    if (resource.resourceName) {
      items.push(resource.resourceName.split('/')[0]);
      return;
    }
    if (resource.resourceGroup) {
      icon = 'folder';
      items.push(resource.resourceGroup);
      return;
    }
    if (resource.subscription) {
      icon = 'layer-group';
      items.push(resource.subscription);
      return;
    }
  });
  return (
    <span className={cx(styles.truncated, styles.resourceField)}>
      <Icon name={icon} />
      {items.join(', ')}
    </span>
  );
};

export default ResourceField;
