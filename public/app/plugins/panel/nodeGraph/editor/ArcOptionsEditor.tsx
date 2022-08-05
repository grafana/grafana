import { css } from '@emotion/css';
import React from 'react';

import { Field, StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { ArcOption, NodeGraphOptions } from '../types';

type Settings = { filter: (field: Field) => boolean };
type ArcOptionsEditorProps = StandardEditorProps<ArcOption[], Settings, NodeGraphOptions, undefined>;

export const ArcOptionsEditor = ({ value, onChange, context }: ArcOptionsEditorProps) => {
  const styles = useStyles2(getStyles);

  const addArc = () => {
    const newArc = { field: '', color: '' };
    onChange(value ? [...value, newArc] : [newArc]);
  };

  const removeArc = (idx: number) => {
    const copy = value?.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  const updateField = <K extends keyof ArcOption>(idx: number, field: K, newValue: ArcOption[K]) => {
    let arcs = value?.slice() ?? [];
    arcs[idx][field] = newValue;
    onChange(arcs);
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
                updateField(i, 'field', val);
              }}
              item={{
                settings: {
                  filter: (field: Field) => field.name.includes('arc__'),
                },
                id: `arc-field-${i}`,
                name: `arc-field-${i}`,
                editor: () => null,
              }}
            />
            <ColorPicker
              color={arc.color || '#808080'}
              onChange={(val) => {
                updateField(i, 'color', val);
              }}
            />
            <Button size="sm" icon="minus" variant="secondary" onClick={() => removeArc(i)} title="Remove arc" />
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
