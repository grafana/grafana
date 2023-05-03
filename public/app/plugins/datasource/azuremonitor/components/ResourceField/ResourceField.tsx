import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon, Modal, useStyles2, IconName } from '@grafana/ui';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureQueryEditorFieldProps, AzureMonitorResource } from '../../types';
import { Field } from '../Field';
import ResourcePicker from '../ResourcePicker';
import getStyles from '../ResourcePicker/styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseMultipleResourceDetails, setResources } from '../ResourcePicker/utils';

interface ResourceFieldProps<T> extends AzureQueryEditorFieldProps {
  selectableEntryTypes: ResourceRowType[];
  queryType: ResourcePickerQueryType;
  resources: T[];
  inlineField?: boolean;
  labelWidth?: number;
  disableRow: (row: ResourceRow, selectedRows: ResourceRowGroup) => boolean;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
  selectionNotice?: (selectedRows: ResourceRowGroup) => string;
}

type Props = ResourceFieldProps<string | AzureMonitorResource>;

const ResourceField = ({
  query,
  datasource,
  onQueryChange,
  selectableEntryTypes,
  queryType,
  resources,
  inlineField,
  labelWidth,
  disableRow,
  renderAdvanced,
  selectionNotice,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [pickerIsOpen, setPickerIsOpen] = useState(false);

  const handleOpenPicker = useCallback(() => {
    setPickerIsOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerIsOpen(false);
  }, []);

  const handleApply = useCallback(
    (resources: Array<string | AzureMonitorResource>) => {
      onQueryChange(setResources(query, queryType, resources));
      closePicker();
    },
    [closePicker, onQueryChange, query, queryType]
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
          resources={resources}
          onApply={handleApply}
          onCancel={closePicker}
          selectableEntryTypes={selectableEntryTypes}
          queryType={queryType}
          disableRow={disableRow}
          renderAdvanced={renderAdvanced}
          selectionNotice={selectionNotice}
        />
      </Modal>
      <Field label="Resource" inlineField={inlineField} labelWidth={labelWidth}>
        <Button className={styles.resourceFieldButton} variant="secondary" onClick={handleOpenPicker} type="button">
          <ResourceLabel resources={resources} datasource={datasource} />
        </Button>
      </Field>
    </span>
  );
};

interface ResourceLabelProps<T> {
  resources: T[];
  datasource: Datasource;
}

const ResourceLabel = ({ resources, datasource }: ResourceLabelProps<string | AzureMonitorResource>) => {
  const [resourcesComponents, setResourcesComponents] = useState(parseMultipleResourceDetails(resources));

  useEffect(() => {
    setResourcesComponents(parseMultipleResourceDetails(resources));
  }, [resources]);

  if (!resources.length) {
    return <>Select a resource</>;
  }

  return <FormattedResource resources={resourcesComponents} />;
};

interface FormattedResourceProps {
  resources: AzureMonitorResource[];
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
