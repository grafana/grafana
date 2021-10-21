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
  const { value: style, onChange, item } = props;

  const LABEL_WIDTH = 20;
  const styles = useStyles2(getStyles);

  const settings: StyleRuleEditorSettings = item.settings;

  const onChangeComparisonProperty = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const copyStyle = style;
      onChange({
        ...copyStyle,
        rule: {
          ...copyStyle.rule,
          property: e.currentTarget.value,
          operation: copyStyle.rule?.operation ?? ComparisonOperation.EQ,
          value: copyStyle.rule?.value ?? '',
        },
      });
    },
    [onChange, style]
  );

  const onChangeComparison = useCallback(
    (selection: SelectableValue) => {
      const copyStyle = style;
      onChange({
        ...copyStyle,
        rule: {
          ...copyStyle.rule,
          operation: selection.value ?? ComparisonOperation.EQ,
          property: copyStyle.rule?.property ?? '',
          value: copyStyle.rule?.value ?? '',
        },
      });
    },
    [onChange, style]
  );

  const onChangeComparisonValue = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const copyStyle = style;
      onChange({
        ...copyStyle,
        rule: {
          ...copyStyle.rule,
          value: e.currentTarget.value,
          operation: copyStyle.rule?.operation ?? ComparisonOperation.EQ,
          property: copyStyle.rule?.property ?? '',
        },
      });
    },
    [onChange, style]
  );

  const onChangeColor = useCallback(
    (c: string) => {
      const copyStyle = style;
      onChange({ ...copyStyle, fillColor: c });
    },
    [onChange, style]
  );

  const onChangeStrokeWidth = useCallback(
    (num: number | undefined) => {
      const copyStyle = style;
      onChange({ ...copyStyle, strokeWidth: num ?? copyStyle.strokeWidth ?? 1 });
    },
    [onChange, style]
  );

  const onDelete = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  return (
    <InlineFieldRow className={styles.row}>
      <Input
        type="text"
        placeholder={'Feature property'}
        value={`${style?.rule?.property}`}
        onChange={onChangeComparisonProperty}
        aria-label={'Feature property'}
      />
      <InlineField className={styles.inline} grow={true}>
        <Select
          menuShouldPortal
          value={`${style?.rule?.operation}` ?? ComparisonOperation.EQ}
          options={settings.options}
          onChange={onChangeComparison}
          aria-label={'Comparison operator'}
          width={LABEL_WIDTH}
        />
      </InlineField>
      <Input
        type="text"
        placeholder={'value'}
        value={`${style?.rule?.value}`}
        onChange={onChangeComparisonValue}
        aria-label={'Comparison value'}
      />
      <InlineField className={styles.color}>
        <ColorPicker color={style?.fillColor} onChange={onChangeColor} />
      </InlineField>
      <InlineField label="Stroke" className={styles.inline}>
        <NumberInput
          value={style?.strokeWidth ?? 1}
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
