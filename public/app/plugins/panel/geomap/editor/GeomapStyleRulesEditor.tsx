import React, { ChangeEvent, FC, useCallback } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ComparisonOperation, FeatureStyleRuleConfig } from '../types';
import { Button, ColorPicker, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonMapper';
import { css } from '@emotion/css';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';

export const GeomapStyleRulesEditor: FC<StandardEditorProps<FeatureStyleRuleConfig[], any, any>> = (props) => {
  const { value, onChange } = props;

  const OPTIONS = useComparisonOptions();
  const LABEL_WIDTH = 10;

  const styles = useStyles2(getStyles);

  const onAddRule = useCallback(() => {
    onChange([...value, DEFAULT_STYLE_RULE]);
  }, [onChange, value]);

  const onDelete = useCallback(
    (idx) => {
      const remove = [...value];
      remove.splice(idx, 1);
      onChange([...remove]);
    },
    [onChange, value]
  );

  const onChangeColor = useCallback(
    (idx) => (c: string) => {
      const styles = value;
      styles[idx] = { ...styles[idx], fillColor: c };
      onChange([...styles]);
    },
    [onChange, value]
  );

  const onChangeComparison = useCallback(
    (idx) => (selection: SelectableValue) => {
      const styles = value;
      styles[idx] = { ...styles[idx], operation: selection?.value ?? ComparisonOperation.EQ };
      onChange([...styles]);
    },
    [onChange, value]
  );

  const onChangeComparisonValue = useCallback(
    (idx) => (e: ChangeEvent<HTMLInputElement>) => {
      const styles = value;
      styles[idx] = { ...styles[idx], value: e.currentTarget.value };
      onChange([...styles]);
    },
    [onChange, value]
  );

  const onChangeComparisonProperty = useCallback(
    (idx) => (e: ChangeEvent<HTMLInputElement>) => {
      const styles = value;
      styles[idx] = { ...styles[idx], property: e.currentTarget.value };
      onChange([...styles]);
    },
    [onChange, value]
  );

  const onChangeStrokeWidth = useCallback(
    (idx) => (num: number) => {
      const styles = value;
      styles[idx] = { ...styles[idx], strokeWidth: num };
      onChange([...styles]);
    },
    [onChange, value]
  );

  const styleOptions =
    value &&
    value.map((style, idx: number) => {
      return (
        <InlineFieldRow key={`${idx}-${style}`} className={styles.row}>
          <Input
            type="text"
            placeholder={'Feature property'}
            value={`${style?.property}`}
            onChange={onChangeComparisonProperty(idx)}
            aria-label={'Feature property'}
          />
          <InlineField labelWidth={LABEL_WIDTH} className={styles.inline}>
            <Select
              menuShouldPortal
              value={style?.operation}
              options={OPTIONS}
              onChange={onChangeComparison(idx)}
              aria-label={'Comparison operator'}
            />
          </InlineField>
          <Input
            type="text"
            placeholder={'value'}
            value={`${style?.value}`}
            onChange={onChangeComparisonValue(idx)}
            aria-label={'Comparison value'}
          />
          <InlineField className={styles.color}>
            <ColorPicker color={value[idx]?.fillColor} onChange={onChangeColor(idx)} />
          </InlineField>
          <InlineField label="Stroke" className={styles.inline}>
            <NumberInput
              value={style?.strokeWidth ?? 1}
              min={1}
              max={20}
              step={0.5}
              aria-label={'Stroke width'}
              onChange={onChangeStrokeWidth(idx)}
            />
          </InlineField>
          <Button
            size="md"
            icon="trash-alt"
            onClick={() => onDelete(idx)}
            variant="secondary"
            aria-label={'Delete style rule'}
            className={styles.button}
          ></Button>
        </InlineFieldRow>
      );
    });

  return (
    <>
      {styleOptions}
      <Button size="sm" icon="plus" onClick={onAddRule} variant="secondary" aria-label={'Add geomap style rule'}>
        {'Add style rule'}
      </Button>
    </>
  );
};

const useComparisonOptions = () => {
  const options = [];
  for (const value of Object.values(ComparisonOperation)) {
    options.push({ value: value, label: value });
  }
  return options;
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
