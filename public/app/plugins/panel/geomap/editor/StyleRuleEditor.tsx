import React, { FC, useCallback, useMemo } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button, ColorPicker, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';
import { Observable } from 'rxjs';
import { useObservable } from 'react-use';
import { FeatureLike } from 'ol/Feature';

export interface StyleRuleEditorSettings {
  options: SelectableValue[];
  features: Observable<FeatureLike[]>;
  properties: Observable<SelectableValue[]>;
}

export const StyleRuleEditor: FC<StandardEditorProps<FeatureStyleConfig, any, any, StyleRuleEditorSettings>> = (
  props
) => {
  const { value, onChange, item } = props;

  const settings: StyleRuleEditorSettings = item.settings;
  const { options, features, properties } = settings;

  const propertyOptions = useObservable(properties);
  const feats = useObservable(features);

  const uniqueValues = useMemo(() => {
    const uniqueValues: SelectableValue[] = [];
    if (feats) {
      if (value?.rule) {
        const values = [];
        for (let f = 0; f < feats.length; f++) {
          if (value.rule) {
            values.push(feats[f].get(value.rule.property));
          }
        }
        const unique = [...new Set(values)].sort();
        for (let v = 0; v < unique.length; v++) {
          uniqueValues.push({ value: unique[v], label: `${unique[v]}` });
        }
      }
    }
    return uniqueValues;
  }, [feats, value]);

  const styles = useStyles2(getStyles);

  const LABEL_WIDTH = 10;

  const onChangeProperty = useCallback(
    (selection: SelectableValue) => {
      onChange({
        ...value,
        rule: {
          ...value.rule,
          property: selection.value,
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

  const onChangeValue = useCallback(
    (selection: SelectableValue) => {
      onChange({
        ...value,
        rule: {
          ...value.rule,
          value: selection.value,
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
          <Select
            menuShouldPortal
            placeholder={'Feature property'}
            value={`${value?.rule?.property}`}
            options={propertyOptions}
            onChange={onChangeProperty}
            aria-label={'Feature property'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <Select
            menuShouldPortal
            value={`${value?.rule?.operation}` ?? ComparisonOperation.EQ}
            options={options}
            onChange={onChangeComparison}
            aria-label={'Comparison operator'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          {/* <Input
            type="text"
            placeholder={'value'}
            value={`${value?.rule?.value}`}
            onChange={onChangeComparisonValue}
            aria-label={'Comparison value'}
          /> */}
          <Select
            menuShouldPortal
            placeholder={'value'}
            value={`${value?.rule?.value}`}
            options={uniqueValues}
            onChange={onChangeValue}
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
