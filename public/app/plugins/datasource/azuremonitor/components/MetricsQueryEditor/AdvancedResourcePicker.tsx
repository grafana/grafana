import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { AccessoryButton } from '@grafana/plugin-ui';
import { Input, Label, InlineField, Button, useStyles2 } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorResource } from '../../types/query';

export interface ResourcePickerProps<T> {
  resources: T[];
  onChange: (resources: T[]) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  resourceList: css({ display: 'flex', columnGap: theme.spacing(1), flexWrap: 'wrap', marginBottom: theme.spacing(1) }),
  resource: css({ flex: '0 0 auto' }),
  resourceLabel: css({ padding: theme.spacing(1) }),
  resourceGroupAndName: css({ display: 'flex', columnGap: theme.spacing(0.5) }),
});

const AdvancedResourcePicker = ({ resources, onChange }: ResourcePickerProps<AzureMonitorResource>) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Ensure there is at least one resource
    if (resources.length === 0) {
      onChange([{}]);
    }
  }, [resources, onChange]);

  const onResourceChange = (index: number, resource: AzureMonitorResource) => {
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
    onChange(
      resources.concat({
        subscription: resources[0]?.subscription,
        metricNamespace: resources[0]?.metricNamespace,
        resourceGroup: '',
        resourceName: '',
      })
    );
  };

  const onCommonPropChange = (r: Partial<AzureMonitorResource>) => {
    onChange(resources.map((resource) => ({ ...resource, ...r })));
  };

  return (
    <>
      <InlineField
        label={t('components.advanced-resource-picker.label-subscription', 'Subscription')}
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-subscription`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.subscription.input}
      >
        <Input
          id={`input-advanced-resource-picker-subscription`}
          value={resources[0]?.subscription ?? ''}
          onChange={(event) => onCommonPropChange({ subscription: event.currentTarget.value })}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX"
        />
      </InlineField>
      <InlineField
        label={t('components.advanced-resource-picker.label-namespace', 'Namespace')}
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-metricNamespace`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.namespace.input}
        invalid={resources[0]?.metricNamespace?.endsWith('/')}
        error={'Namespace cannot end with a "/"'}
      >
        <Input
          id={`input-advanced-resource-picker-metricNamespace`}
          value={resources[0]?.metricNamespace ?? ''}
          onChange={(event) => onCommonPropChange({ metricNamespace: event.currentTarget.value })}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="Microsoft.Insights/metricNamespaces"
        />
      </InlineField>
      <InlineField
        label={t('components.advanced-resource-picker.label-region', 'Region')}
        grow
        transparent
        htmlFor={`input-advanced-resource-picker-region`}
        labelWidth={15}
        data-testid={selectors.components.queryEditor.resourcePicker.advanced.region.input}
        tooltip={t(
          'components.advanced-resource-picker.tooltip-region',
          'The code region of the resource. Optional for one resource but mandatory when selecting multiple ones.'
        )}
      >
        <Input
          id={`input-advanced-resource-picker-region`}
          value={resources[0]?.region ?? ''}
          onChange={(event) => onCommonPropChange({ region: event.currentTarget.value })}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="northeurope"
        />
      </InlineField>
      <div className={styles.resourceList}>
        {resources.map((resource, index) => (
          <div key={`resource-${index + 1}`} className={styles.resource}>
            {resources.length !== 1 && (
              <Label className={styles.resourceLabel}>
                <Trans
                  i18nKey="components.advanced-resource-picker.label-resource-number"
                  values={{ resourceNum: index + 1 }}
                >
                  Resource {'{{resourceNum}}'}
                </Trans>
              </Label>
            )}
            <InlineField
              label={t('components.advanced-resource-picker.label-resource-group', 'Resource Group')}
              transparent
              htmlFor={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input}
            >
              <div className={styles.resourceGroupAndName}>
                <Input
                  id={`input-advanced-resource-picker-resourceGroup-${index + 1}`}
                  value={resource?.resourceGroup ?? ''}
                  onChange={(event) =>
                    onResourceChange(index, { ...resource, resourceGroup: event.currentTarget.value })
                  }
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="resource-group"
                />
                <AccessoryButton
                  aria-label={t('components.advanced-resource-picker.aria-label-remove', 'Remove')}
                  icon="times"
                  variant="secondary"
                  onClick={() => removeResource(index)}
                  hidden={resources.length === 1}
                  data-testid={'remove-resource'}
                />
              </div>
            </InlineField>

            <InlineField
              label={t('components.advanced-resource-picker.label-resource-name', 'Resource Name')}
              transparent
              htmlFor={`input-advanced-resource-picker-resourceName-${index + 1}`}
              labelWidth={15}
              data-testid={selectors.components.queryEditor.resourcePicker.advanced.resource.input}
            >
              <Input
                id={`input-advanced-resource-picker-resourceName-${index + 1}`}
                value={resource?.resourceName ?? ''}
                onChange={(event) => onResourceChange(index, { ...resource, resourceName: event.currentTarget.value })}
                placeholder={t('components.advanced-resource-picker.placeholder-resource-name', 'name')}
              />
            </InlineField>
          </div>
        ))}
      </div>
      <Button
        aria-label={t('components.advanced-resource-picker.aria-label-add', 'Add')}
        icon="plus"
        variant="secondary"
        onClick={addResource}
        type="button"
      >
        <Trans i18nKey="components.advanced-resource-picker.button-add-resource">Add resource</Trans>
      </Button>
    </>
  );
};

export default AdvancedResourcePicker;
