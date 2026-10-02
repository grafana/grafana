import { css } from '@emotion/css';

import {
  FieldMatcherID,
  Registry,
  type GrafanaTheme2,
  type SelectableValue,
  type TransformerUIProps,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaConfigFromQueryDynamicName } from '@grafana/runtime/internal';
import { fieldMatchersUI, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { type FieldMatcherUIRegistryItem } from '@grafana/ui/internal';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

import { CustomCFQMatchers, type ConfigFromQueryTransformOptions } from './configFromQuery';

export interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

const getDynamicFieldNameMatcherOptions: () => FieldMatcherUIRegistryItem<string> = () => {
  const base = fieldMatchersUI.get(FieldMatcherID.byName);
  return {
    ...base,
    id: CustomCFQMatchers.dynamicFieldName,
    name: t(
      'transformers.config-from-query-transformer-editor.name-dynamic-field-name-matcher',
      'Fields with dynamic names'
    ),
    description: t(
      'grafana-ui.matchers-ui.description-fields-by-query',
      'Set properties for field names that are returned by your config query'
    ),
  };
};

const customFieldMatchers = new Registry<FieldMatcherUIRegistryItem<string>>(() => [
  ...fieldMatchersUI.list(),
  getDynamicFieldNameMatcherOptions(),
]);

export function ConfigFromQueryTransformerEditor({ input, onChange, options }: Props) {
  const styles = useStyles2(getStyles);

  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId || 'config';
  const currentMatcher = options.applyTo ?? { id: FieldMatcherID.byType, options: 'number' };
  const enableDynamicFieldName = useFlagGrafanaConfigFromQueryDynamicName();

  const fieldMatchersRegistry = enableDynamicFieldName ? customFieldMatchers : fieldMatchersUI;
  const matcherUI = fieldMatchersRegistry.getIfExists(currentMatcher.id) ?? fieldMatchersUI.get(FieldMatcherID.byType);
  const configFrame = input.find((x) => x.refId === currentRefId);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      configRefId: value.value || 'config',
    });
  };

  const onMatcherChange = (value: SelectableValue<string>) => {
    onChange({ ...options, applyTo: { id: value.value! } });
  };

  const onMatcherConfigChange = (matcherOption: unknown) => {
    onChange({ ...options, applyTo: { id: currentMatcher.id, options: matcherOption } });
  };

  const matchers = fieldMatchersRegistry.selectOptions().options;
  const inputData =
    currentMatcher.id === CustomCFQMatchers.dynamicFieldName ? (configFrame ? [configFrame] : []) : input;

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.config-from-query-transformer-editor.label-config-query', 'Config query')}
          labelWidth={20}
        >
          <Select onChange={onRefIdChange} options={refIds} value={currentRefId} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.config-from-query-transformer-editor.label-apply-to', 'Apply to')}
          labelWidth={20}
        >
          <Select onChange={onMatcherChange} options={matchers} value={currentMatcher.id} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.config-from-query-transformer-editor.label-apply-to-options', 'Apply to options')}
          labelWidth={20}
          className={styles.matcherOptions}
        >
          <matcherUI.component
            id={matcherUI.id}
            matcher={matcherUI.matcher}
            data={inputData}
            options={currentMatcher.options}
            onChange={onMatcherConfigChange}
            scope={currentMatcher.scope}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        {configFrame && (
          <FieldToConfigMappingEditor
            frame={{
              ...configFrame,
              fields: configFrame.fields.filter(
                (v) => options.applyTo?.id !== CustomCFQMatchers.dynamicFieldName || v.name !== options.applyTo?.options
              ),
            }}
            mappings={options.mappings}
            onChange={(mappings) => onChange({ ...options, mappings })}
            withReducers={options.applyTo?.id !== CustomCFQMatchers.dynamicFieldName}
          />
        )}
      </InlineFieldRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  matcherOptions: css({
    minWidth: '404px',
  }),
});
