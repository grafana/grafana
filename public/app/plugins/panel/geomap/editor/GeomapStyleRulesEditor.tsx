import React, { FC, useCallback } from 'react';
import { StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button } from '@grafana/ui';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonLayer';
import { StyleRuleEditor, StyleRuleEditorSettings } from './StyleRuleEditor';

export const GeomapStyleRulesEditor: FC<StandardEditorProps<FeatureStyleConfig[], any, any>> = (props) => {
  const { value, onChange, context } = props;

  const OPTIONS = getComparisonOperatorOptions();

  const onAddRule = useCallback(() => {
    onChange([...value, DEFAULT_STYLE_RULE]);
  }, [onChange, value]);

  const onRuleChange = useCallback(
    (idx) => (style: FeatureStyleConfig | undefined) => {
      const copyStyles = [...value];
      if (style) {
        copyStyles[idx] = style;
      } else {
        //assume undefined is only returned on delete
        copyStyles.splice(idx, 1);
      }
      onChange(copyStyles);
    },
    [onChange, value]
  );

  const styleOptions =
    value &&
    value.map((style, idx: number) => {
      const itemSettings: StandardEditorsRegistryItem<any, StyleRuleEditorSettings> = {
        settings: { options: OPTIONS },
      } as any;

      return (
        <StyleRuleEditor
          value={style}
          onChange={onRuleChange(idx)}
          context={context}
          item={itemSettings}
          key={`${idx}-${style.check?.property}`}
        />
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

const getComparisonOperatorOptions = () => {
  const options = [];
  for (const value of Object.values(ComparisonOperation)) {
    options.push({ value: value, label: value });
  }
  return options;
};
