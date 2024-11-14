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
import { fieldMatchersUI, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

import { configFromDataTransformer, ConfigFromQueryTransformOptions } from './configFromQuery';

export interface Props extends TransformerUIProps<ConfigFromQueryTransformOptions> {}

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
        <InlineField label="Config query" labelWidth={20}>
          <Select onChange={onRefIdChange} options={refIds} value={currentRefId} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Apply to" labelWidth={20}>
          <Select onChange={onMatcherChange} options={matchers} value={currentMatcher.id} width={30} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Apply to options" labelWidth={20} className={styles.matcherOptions}>
          <matcherUI.component
            matcher={matcherUI.matcher}
            data={input}
            options={currentMatcher.options}
            onChange={onMatcherConfigChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        {configFrame && (
          <FieldToConfigMappingEditor
            frame={configFrame}
            mappings={options.mappings}
            onChange={(mappings) => onChange({ ...options, mappings })}
            withReducers
          />
        )}
      </InlineFieldRow>
    </>
  );
}

export const configFromQueryTransformRegistryItem: TransformerRegistryItem<ConfigFromQueryTransformOptions> = {
  id: configFromDataTransformer.id,
  editor: ConfigFromQueryTransformerEditor,
  transformation: configFromDataTransformer,
  name: configFromDataTransformer.name,
  description: configFromDataTransformer.description,
  state: PluginState.beta,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(configFromDataTransformer.id).helperDocs,
};

const getStyles = (theme: GrafanaTheme2) => ({
  matcherOptions: css({
    minWidth: '404px',
  }),
});
