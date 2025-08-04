import { css } from '@emotion/css';

import { Field, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ColorPicker, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

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
              }}
            />
            <ColorPicker
              color={arc.color || '#808080'}
              onChange={(val) => {
                updateField(i, 'color', val);
              }}
            />
            <Button
              size="sm"
              icon="minus"
              variant="secondary"
              onClick={() => removeArc(i)}
              title={t('nodeGraph.arc-options-editor.title-remove-arc', 'Remove arc')}
            />
          </div>
        );
      })}
      <Button size={'sm'} icon="plus" onClick={addArc} variant="secondary">
        <Trans i18nKey="nodeGraph.arc-options-editor.add-arc">Add arc</Trans>
      </Button>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    section: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: `0 ${theme.spacing(1)}`,
      marginBottom: theme.spacing(1),
    }),
  };
};
