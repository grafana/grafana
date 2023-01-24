import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Icon, Input, Tooltip, Label, Button, useStyles2 } from '@grafana/ui';

export interface ResourcePickerProps<T> {
  resources: T[];
  onChange: (resources: T[]) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  resourceList: css({ width: '100%', display: 'flex', marginBlock: theme.spacing(1) }),
});

const AdvancedResourcePicker = ({ resources, onChange }: ResourcePickerProps<string>) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Ensure there is at least one resource
    if (resources.length === 0) {
      onChange(['']);
    }
  }, [resources, onChange]);

  const onResourceChange = (index: number, resource: string) => {
    const newResources = [...resources];
    newResources[index] = resource;
    onChange(newResources);
  };

  const removeResource = (index: number) => {
    const newResources = [...resources];
    newResources.splice(index, 1);
    onChange(newResources);
  };

  const addResource = () => {
    onChange(resources.concat(''));
  };

  return (
    <>
      <Label>
        <h6>
          Resource URI(s){' '}
          <Tooltip
            content={
              <>
                Manually edit the{' '}
                <a
                  href="https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-standard-columns#_resourceid"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  resource uri
                </a>
                . Supports the use of multiple template variables (ex: /subscriptions/$subId/resourceGroups/$rg)
              </>
            }
            placement="right"
            interactive={true}
          >
            <Icon name="info-circle" />
          </Tooltip>
        </h6>
      </Label>
      {resources.map((resource, index) => (
        <div key={`resource-${index + 1}`}>
          <div className={styles.resourceList}>
            <Input
              id={`input-advanced-resource-picker-${index + 1}`}
              value={resource}
              onChange={(event) => onResourceChange(index, event.currentTarget.value)}
              placeholder="ex: /subscriptions/$subId"
              data-testid={`input-advanced-resource-picker-${index + 1}`}
            />
            <AccessoryButton
              aria-label="remove"
              icon="times"
              variant="secondary"
              onClick={() => removeResource(index)}
              data-testid={`remove-resource`}
              hidden={resources.length === 1}
            />
          </div>
        </div>
      ))}
      <Button aria-label="Add" icon="plus" variant="secondary" onClick={addResource} type="button">
        Add resource URI
      </Button>
    </>
  );
};

export default AdvancedResourcePicker;
