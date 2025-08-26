import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { AccessoryButton } from '@grafana/plugin-ui';
import { Icon, Input, Tooltip, Label, Button, useStyles2, TextLink } from '@grafana/ui';

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
          <Trans i18nKey="components.advanced-resource-picker.label-resource-uri">Resource URI(s) </Trans>
          <Tooltip
            content={
              <Trans i18nKey="components.advanced-resource-picker.tooltip-resource-uri">
                Manually edit the{' '}
                <TextLink
                  href="https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-standard-columns#_resourceid"
                  external
                >
                  resource uri
                </TextLink>
                . Supports the use of multiple template variables (ex: /subscriptions/$subId/resourceGroups/$rg)
              </Trans>
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
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="ex: /subscriptions/$subId"
              data-testid={`input-advanced-resource-picker-${index + 1}`}
            />
            <AccessoryButton
              aria-label={t('components.advanced-resource-picker.aria-label-remove', 'Remove')}
              icon="times"
              variant="secondary"
              onClick={() => removeResource(index)}
              data-testid={`remove-resource`}
              hidden={resources.length === 1}
            />
          </div>
        </div>
      ))}
      <Button
        aria-label={t('components.advanced-resource-picker.aria-label-add', 'Add')}
        icon="plus"
        variant="secondary"
        onClick={addResource}
        type="button"
      >
        <Trans i18nKey="components.advanced-resource-picker.button-add-resource-uri">Add resource URI</Trans>
      </Button>
    </>
  );
};

export default AdvancedResourcePicker;
