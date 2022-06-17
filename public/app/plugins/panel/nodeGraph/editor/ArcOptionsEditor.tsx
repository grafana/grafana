import { css } from '@emotion/css';
import React from 'react';

import { Field, FieldNamePickerConfigSettings, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { Button, ColorPicker, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { ArcOption, NodeGraphOptions } from '../types';

type ArcOptionsEditorProps = StandardEditorProps<ArcOption[], any, NodeGraphOptions, any>;

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { filter: (field: Field) => field.name.includes('arc__') },
} as any;

export const ArcOptionsEditor = ({ value, onChange, context }: ArcOptionsEditorProps) => {
  const styles = useStyles2(getStyles);
  const addArc = () => {
    const newArc = { field: '', color: '' };
    onChange(value ? [...value, newArc] : [newArc]);
  };

  return (
    <>
      {value?.map((arc, i) => {
        return (
          <div className={styles.section} key={i}>
            <FieldNamePicker
              context={context}
              value={arc.field ?? ''}
              onChange={(val) => {
                let arcs = value.slice() ?? [];
                arcs[i].field = val;
                onChange(arcs);
              }}
              item={fieldNamePickerSettings}
            />
            <ColorPicker
              color={arc.color || '#808080'}
              onChange={(color) => {
                let arcs = value.slice() ?? [];
                arcs[i].color = color;
                onChange(arcs);
              }}
            />
            <Button
              size="sm"
              icon="minus"
              variant="secondary"
              onClick={() => {
                const copy = value.slice();
                copy.splice(i, 1);
                onChange(copy);
              }}
              title="Remove arc"
            />
          </div>
        );
      })}
      <Button size={'sm'} icon="plus" onClick={addArc} variant="secondary">
        Add arc
      </Button>
    </>
  );
};

const getStyles = () => {
  return {
    section: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0 8px;
      margin-bottom: 8px;
    `,
  };
};
