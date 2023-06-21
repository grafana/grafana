import { css } from '@emotion/css';
import { FeatureLike } from 'ol/Feature';
import React, { useCallback, useMemo } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { GrafanaTheme2, SelectableValue, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ComparisonOperation } from '@grafana/schema';
import { Button, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { comparisonOperationOptions } from '@grafana/ui/src/components/MatchersUI/FieldValueMatcher';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonLayer';
import { defaultStyleConfig, StyleConfig } from '../style/types';
import { FeatureStyleConfig } from '../types';
import { getUniqueFeatureValues, LayerContentInfo } from '../utils/getFeatures';
import { getSelectionInfo } from '../utils/selection';

import { StyleEditor } from './StyleEditor';

export interface StyleRuleEditorSettings {
  features: Observable<FeatureLike[]>;
  layerInfo: Observable<LayerContentInfo>;
}

type Props = StandardEditorProps<FeatureStyleConfig, any, unknown, StyleRuleEditorSettings>;

export const StyleRuleEditor = ({ value, onChange, item, context }: Props) => {
  const settings: StyleRuleEditorSettings = item.settings;
  const { features, layerInfo } = settings;

  const propertyOptions = useObservable(layerInfo);
  const feats = useObservable(features);

  const uniqueSelectables = useMemo(() => {
    const key = value?.check?.property;
    if (key && feats && value.check?.operation === ComparisonOperation.EQ) {
      return getUniqueFeatureValues(feats, key).map((v) => {
        let newValue;
        let isNewValueNumber = !isNaN(Number(v));

        if (isNewValueNumber) {
          newValue = {
            value: Number(v),
            label: v,
          };
        } else {
          newValue = { value: v, label: v };
        }

        return newValue;
      });
    }
    return [];
  }, [feats, value]);

  const styles = useStyles2(getStyles);

  const LABEL_WIDTH = 10;

  const onChangeProperty = useCallback(
    (selection?: SelectableValue) => {
      onChange({
        ...value,
        check: {
          ...value.check!,
          property: selection?.value,
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparison = useCallback(
    (selection: SelectableValue) => {
      onChange({
        ...value,
        check: {
          ...value.check!,
          operation: selection.value ?? ComparisonOperation.EQ,
        },
      });
    },
    [onChange, value]
  );

  const onChangeValue = useCallback(
    (selection?: SelectableValue) => {
      onChange({
        ...value,
        check: {
          ...value.check!,
          value: selection?.value,
        },
      });
    },
    [onChange, value]
  );

  const onChangeNumericValue = useCallback(
    (v?: number) => {
      onChange({
        ...value,
        check: {
          ...value.check!,
          value: v!,
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

  const check = value.check ?? DEFAULT_STYLE_RULE.check!;
  const propv = getSelectionInfo(check.property, propertyOptions?.propertes);
  const valuev = getSelectionInfo(check.value, uniqueSelectables);

  return (
    <div className={styles.rule}>
      <InlineFieldRow className={styles.row}>
        <InlineField label="Rule" labelWidth={LABEL_WIDTH} grow={true}>
          <Select
            placeholder={'Feature property'}
            value={propv.current}
            options={propv.options}
            onChange={onChangeProperty}
            aria-label={'Feature property'}
            isClearable
            allowCustomValue
          />
        </InlineField>
        <InlineField className={styles.inline}>
          <Select
            value={comparisonOperationOptions.find((v) => v.value === check.operation)}
            options={comparisonOperationOptions}
            onChange={onChangeComparison}
            aria-label={'Comparison operator'}
            width={8}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <div className={styles.flexRow}>
            {(check.operation === ComparisonOperation.EQ || check.operation === ComparisonOperation.NEQ) && (
              <Select
                placeholder={'value'}
                value={valuev.current}
                options={valuev.options}
                onChange={onChangeValue}
                aria-label={'Comparison value'}
                isClearable
                allowCustomValue
              />
            )}
            {check.operation !== ComparisonOperation.EQ && (
              <NumberInput
                key={`${check.property}/${check.operation}`}
                value={!isNaN(Number(check.value)) ? Number(check.value) : 0}
                placeholder="numeric value"
                onChange={onChangeNumericValue}
              />
            )}
          </div>
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
          item={
            {
              settings: {
                simpleFixedValues: true,
                layerInfo,
              },
            } as StandardEditorsRegistryItem
          }
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
  flexRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
  `,
});
