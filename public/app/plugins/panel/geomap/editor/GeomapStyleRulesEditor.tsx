import React, { FC, useCallback } from 'react';
import { StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ComparisonOperation, FeatureStyleConfig } from '../types';
import { Button } from '@grafana/ui';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonMapper';
import { StyleRuleEditor, StyleRuleEditorSettings } from './StyleRuleEditor';

export const GeomapStyleRulesEditor: FC<StandardEditorProps<FeatureStyleConfig[], any, any>> = (props) => {
  const { value: styles, onChange, context } = props;

  const OPTIONS = useComparisonOptions();

  const onAddRule = useCallback(() => {
    onChange([...styles, DEFAULT_STYLE_RULE]);
  }, [onChange, styles]);

  const onRuleChange = useCallback(
    (idx) => (style: FeatureStyleConfig | undefined) => {
      const copyStyles = [...styles];
      if (style) {
        copyStyles[idx] = style;
      } else {
        //assume undefined is only returned on delete
        copyStyles.splice(idx, 1);
      }
      onChange([...copyStyles]);
    },
    [onChange, styles]
  );

  const styleOptions =
    styles &&
    styles.map((style, idx: number) => {
      const itemSettings: StandardEditorsRegistryItem<any, StyleRuleEditorSettings> = {
        settings: { options: OPTIONS },
      } as any;

      return (
        <StyleRuleEditor
          value={style}
          onChange={onRuleChange(idx)}
          context={context}
          item={itemSettings}
          key={`${idx}-${style.rule}`}
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

const useComparisonOptions = () => {
  const options = [];
  for (const value of Object.values(ComparisonOperation)) {
    options.push({ value: value, label: value });
  }
  return options;
};
