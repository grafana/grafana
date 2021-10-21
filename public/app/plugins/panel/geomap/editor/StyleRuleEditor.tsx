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

  const WIDTH = 10;
  const styles = useStyles2(getStyles);

  const settings: StyleRuleEditorSettings = item.settings;

  const onChangeComparisonProperty = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const style = value;
      onChange({
        ...style,
        rule: {
          ...style.rule,
          property: e.currentTarget.value,
          operation: style.rule?.operation ?? ComparisonOperation.EQ,
          value: style.rule?.value ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparison = useCallback(
    (selection: SelectableValue) => {
      const style = value;
      onChange({
        ...style,
        rule: {
          ...style.rule,
          operation: selection.value ?? ComparisonOperation.EQ,
          property: style.rule?.property ?? '',
          value: style.rule?.value ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparisonValue = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const style = value;
      onChange({
        ...style,
        rule: {
          ...style.rule,
          value: e.currentTarget.value,
          operation: style.rule?.operation ?? ComparisonOperation.EQ,
          property: style.rule?.property ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeColor = useCallback(
    (c: string) => {
      const style = value;
      onChange({ ...style, fillColor: c });
    },
    [onChange, value]
  );

  const onChangeStrokeWidth = useCallback(
    (num: number | undefined) => {
      const style = value;
      onChange({ ...style, strokeWidth: num ?? style.strokeWidth ?? 1 });
    },
    [onChange, value]
  );

  const onDelete = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  return (
    <InlineFieldRow className={styles.row}>
      <Input
        type="text"
        placeholder={'Feature property'}
        value={`${value?.rule?.property}`}
        onChange={onChangeComparisonProperty}
        aria-label={'Feature property'}
        width={WIDTH}
      />
      <InlineField className={styles.inline} grow={true}>
        <Select
          menuShouldPortal
          value={`${value?.rule?.operation}` ?? ComparisonOperation.EQ}
          options={settings.options}
          onChange={onChangeComparison}
          aria-label={'Comparison operator'}
          width={WIDTH}
        />
      </InlineField>
      <Input
        type="text"
        placeholder={'value'}
        value={`${value?.rule?.value}`}
        onChange={onChangeComparisonValue}
        aria-label={'Comparison value'}
      />
      <InlineField className={styles.color}>
        <ColorPicker color={value?.fillColor} onChange={onChangeColor} />
      </InlineField>
      <InlineField label="Stroke" className={styles.inline}>
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
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css`
    display: flex;
    flex-wrap: nowrap;
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
    margin-left: ${theme.spacing(2)};
  `,
  button: css`
    margin-left: 4px;
  `,
});
