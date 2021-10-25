import React, { ChangeEvent, FC, useCallback } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button, ColorPicker, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';

export interface StyleRuleEditorSettings {
  options: SelectableValue[];
}

export const StyleRuleEditor: FC<StandardEditorProps<FeatureStyleConfig, any, any, StyleRuleEditorSettings>> = (
  props
) => {
  const { value, onChange, item } = props;
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

  const onChangeColor = useCallback(
    (c: string) => {
      onChange({ ...value, fillColor: c });
    },
    [onChange, value]
  );

  const onChangeStrokeWidth = useCallback(
    (num: number | undefined) => {
      onChange({ ...value, strokeWidth: num ?? value.strokeWidth ?? 1 });
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
      </InlineFieldRow>
      <InlineFieldRow className={styles.row}>
        <InlineField label="Style" labelWidth={LABEL_WIDTH} className={styles.color}>
          <ColorPicker color={value?.fillColor} onChange={onChangeColor} />
        </InlineField>
        <InlineField label="Stroke" className={styles.inline} grow={true}>
          <NumberInput
            value={value?.strokeWidth ?? 1}
            min={1}
            max={20}
            step={0.5}
            aria-label={'Stroke width'}
            onChange={onChangeStrokeWidth}
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
  color: css`
    align-items: center;
    margin-bottom: 0;
    margin-right: 4px;
  `,
  button: css`
    margin-left: 4px;
  `,
});
