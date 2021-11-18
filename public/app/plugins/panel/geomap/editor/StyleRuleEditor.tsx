import React, { ChangeEvent, FC, useCallback } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { StyleEditor } from '../layers/data/StyleEditor';
import { defaultStyleConfig, StyleConfig } from '../style/types';

export interface StyleRuleEditorSettings {
  options: SelectableValue[];
}

export const StyleRuleEditor: FC<StandardEditorProps<FeatureStyleConfig, any, any, StyleRuleEditorSettings>> = (
  props
) => {
  const { value, onChange, item, context } = props;
  const settings: StyleRuleEditorSettings = item.settings;

  const styles = useStyles2(getStyles);

  const LABEL_WIDTH = 10;

  const onChangeComparisonProperty = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...value,
        rule: {
          ...value.rule,
          property: e.currentTarget.value,
          operation: value.rule?.operation ?? ComparisonOperation.EQ,
          value: value.rule?.value ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparison = useCallback(
    (selection: SelectableValue) => {
      onChange({
        ...value,
        rule: {
          ...value.rule,
          operation: selection.value ?? ComparisonOperation.EQ,
          property: value.rule?.property ?? '',
          value: value.rule?.value ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparisonValue = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...value,
        rule: {
          ...value.rule,
          value: e.currentTarget.value,
          operation: value.rule?.operation ?? ComparisonOperation.EQ,
          property: value.rule?.property ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeStyle = useCallback(
    (style?: StyleConfig) => {
      onChange({ ...value, style });
    },
    [onChange, value]
  );

  const onDelete = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  return (
    <div className={styles.rule}>
      <InlineFieldRow className={styles.row}>
        <InlineField label="Rule" labelWidth={LABEL_WIDTH} grow={true}>
          <Input
            type="text"
            placeholder={'Feature property'}
            value={`${value?.rule?.property}`}
            onChange={onChangeComparisonProperty}
            aria-label={'Feature property'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <Select
            menuShouldPortal
            value={`${value?.rule?.operation}` ?? ComparisonOperation.EQ}
            options={settings.options}
            onChange={onChangeComparison}
            aria-label={'Comparison operator'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <Input
            type="text"
            placeholder={'value'}
            value={`${value?.rule?.value}`}
            onChange={onChangeComparisonValue}
            aria-label={'Comparison value'}
          />
        </InlineField>
        <Button
          size="md"
          icon="trash-alt"
          onClick={() => onDelete()}
          variant="secondary"
          aria-label={'Delete style rule'}
          className={styles.button}
        ></Button>
      </InlineFieldRow>
      <div>
        <StyleEditor
          value={value.style ?? defaultStyleConfig}
          context={context}
          onChange={onChangeStyle}
          item={{} as any}
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  rule: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  row: css`
    display: flex;
    margin-bottom: 4px;
  `,
  inline: css`
    margin-bottom: 0;
    margin-left: 4px;
  `,
  button: css`
    margin-left: 4px;
  `,
});
