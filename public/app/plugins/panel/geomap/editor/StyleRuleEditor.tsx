import React, { ChangeEvent, FC, useCallback } from 'react';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { StyleEditor } from '../layers/data/StyleEditor';
import { defaultStyleConfig, StyleConfig } from '../style/types';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonLayer';

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
        check: {
          ...value.check,
          property: e.currentTarget.value,
          operation: value.check?.operation ?? ComparisonOperation.EQ,
          value: value.check?.value ?? '',
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
          ...value.check,
          operation: selection.value ?? ComparisonOperation.EQ,
          property: value.check?.property ?? '',
          value: value.check?.value ?? '',
        },
      });
    },
    [onChange, value]
  );

  const onChangeComparisonValue = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...value,
        check: {
          ...value.check,
          value: e.currentTarget.value,
          operation: value.check?.operation ?? ComparisonOperation.EQ,
          property: value.check?.property ?? '',
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

  return (
    <div className={styles.rule}>
      <InlineFieldRow className={styles.row}>
        <InlineField label="Rule" labelWidth={LABEL_WIDTH} grow={true}>
          <Input
            type="text"
            placeholder={'Feature property'}
            value={check.property ?? ''}
            onChange={onChangeComparisonProperty}
            aria-label={'Feature property'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <Select
            menuShouldPortal
            value={check.operation ?? ComparisonOperation.EQ}
            options={settings.options}
            onChange={onChangeComparison}
            aria-label={'Comparison operator'}
          />
        </InlineField>
        <InlineField className={styles.inline} grow={true}>
          <Input
            type="text"
            placeholder={'value'}
            value={`${check.value}` ?? ''}
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
          item={
            {
              settings: {
                simpleFixedValues: true,
              },
            } as any
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
});
