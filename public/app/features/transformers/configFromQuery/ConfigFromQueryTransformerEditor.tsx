import { css } from '@emotion/css';

import {
  FieldMatcherID,
  GrafanaTheme2,
  PluginState,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, fieldMatchersUI, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
//import { FieldNamePicker } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import { configMapHandlers } from '../fieldToConfigMapping/fieldToConfigMapping';
import darkImage from '../images/dark/configFromData.svg';
import lightImage from '../images/light/configFromData.svg';

import { getConfigFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';

export interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

/*const fieldNamePickerSettings = {
  editor: FieldNamePicker,
  id: '',
  name: '',
  settings: { width: 24, isClearable: false },
}; */

export function ConfigFromQueryTransformerEditor({ input, onChange, options }: Props) {
  const styles = useStyles2(getStyles);

  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId || 'config';
  const currentMatcher = options.applyTo ?? { id: FieldMatcherID.byType, options: 'number' };
  const matcherUI = fieldMatchersUI.get(currentMatcher.id);
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

  const matchers = fieldMatchersUI
    .list()
    .filter((o) => !o.excludeFromPicker)
    .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }));

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
            matcher={matcherUI.matcher}
            data={input}
            options={currentMatcher.options}
            onChange={onMatcherConfigChange}
          />
        </InlineField>
        <InlineField>
          <Checkbox
            label={t('transformers.config-from-query-transformer-editor.label-mapping', 'Map results')}
            onChange={(evt) => onChange({ ...options, isDisplayNameMapping: evt.currentTarget.checked })}
            value={options.isDisplayNameMapping}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        {configFrame && (
          <FieldToConfigMappingEditor
            frame={configFrame}
            mappings={options.mappings}
            onChange={(mappings) => onChange({ ...options, mappings })}
            withReducers={!options.isDisplayNameMapping}
            configOverride={
              options.isDisplayNameMapping
                ? configMapHandlers.filter((cmh) => cmh.key === 'mappings.value' || cmh.key === 'mappings.text')
                : undefined
            }
          />
        )}
      </InlineFieldRow>
    </>
  );
}

export const getConfigFromQueryTransformRegistryItem: () => TransformerRegistryItem<ConfigFromQueryTransformOptions> =
  () => {
    const configFromDataTransformer = getConfigFromDataTransformer();
    return {
      id: configFromDataTransformer.id,
      editor: ConfigFromQueryTransformerEditor,
      transformation: configFromDataTransformer,
      name: configFromDataTransformer.name,
      description: configFromDataTransformer.description,
      state: PluginState.beta,
      categories: new Set([TransformerCategory.CalculateNewFields]),
      help: getTransformationContent(configFromDataTransformer.id).helperDocs,
      imageDark: darkImage,
      imageLight: lightImage,
    };
  };

const getStyles = (theme: GrafanaTheme2) => ({
  matcherOptions: css({
    minWidth: '404px',
  }),
});
