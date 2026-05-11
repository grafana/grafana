import { css } from '@emotion/css';

import { FieldMatcherID, type GrafanaTheme2, type SelectableValue, type TransformerUIProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { fieldMatchersUI, InlineField, InlineFieldRow, Select, useFieldMatchersOptions, useStyles2 } from '@grafana/ui';

import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';

import { type ConfigFromQueryTransformOptions } from './configFromQuery';

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

  const matchers = useFieldMatchersOptions();

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
            data={input}
            options={currentMatcher.options}
            onChange={onMatcherConfigChange}
            scope={currentMatcher.scope}
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

const getStyles = (theme: GrafanaTheme2) => ({
  matcherOptions: css({
    minWidth: '404px',
  }),
});
