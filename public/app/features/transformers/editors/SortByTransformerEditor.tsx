import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';

import { type GrafanaTheme2, type TransformerUIProps } from '@grafana/data';
import { type SortByField, type SortByTransformerOptions } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { Button, Icon, IconButton, InlineField, InlineSwitch, Select, useStyles2 } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

export const SortByTransformerEditor = ({ input, options, onChange }: TransformerUIProps<SortByTransformerOptions>) => {
  const styles = useStyles2(getStyles);
  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => ({ label: '$' + v.name, value: '$' + v.name }));

  const sorts: SortByField[] = options.sort?.length ? options.sort : [{ field: '' }];
  const hasMultipleSorts = sorts.length > 1;
  const dragHandleLabel = t(
    'transformers.sort-by-transformer-editor.drag-handle-label',
    'Drag to change sort priority'
  );

  const updateSorts = (sort: SortByField[]) => onChange({ ...options, sort });

  const onSortChange = (idx: number, cfg: SortByField) => {
    updateSorts(sorts.map((s, i) => (i === idx ? cfg : s)));
  };

  const onAddSort = () => {
    updateSorts([...sorts, { field: '' }]);
  };

  const onRemoveSort = (idx: number) => {
    updateSorts(sorts.filter((_, i) => i !== idx));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }
    const next = [...sorts];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    updateSorts(next);
  };

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sort-by-transformer-fields" direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} className={styles.list} {...provided.droppableProps}>
              {sorts.map((s, index) => {
                const usedElsewhere = new Set(sorts.filter((_, i) => i !== index).map((other) => other.field));
                const fieldOptions = fieldNames
                  .filter((name) => !usedElsewhere.has(name))
                  .map((name) => ({ label: name, value: name }));

                return (
                  <Draggable
                    key={`sort-${index}`}
                    draggableId={`sort-${index}`}
                    index={index}
                    isDragDisabled={!hasMultipleSorts}
                  >
                    {(dragProvided) => (
                      <div ref={dragProvided.innerRef} className={styles.row} {...dragProvided.draggableProps}>
                        <span
                          {...dragProvided.dragHandleProps}
                          className={cx(styles.dragHandle, { [styles.dragDisabled]: !hasMultipleSorts })}
                          aria-label={dragHandleLabel}
                        >
                          <Icon name="draggabledots" size="lg" title={dragHandleLabel} />
                        </span>
                        <InlineField
                          label={t('transformers.sort-by-transformer-editor.label-field', 'Field')}
                          labelWidth={10}
                          grow={true}
                        >
                          <Select
                            options={[...fieldOptions, ...variables]}
                            value={s.field}
                            placeholder={t(
                              'transformers.sort-by-transformer-editor.placeholder-select-field',
                              'Select field'
                            )}
                            onChange={(v) => {
                              onSortChange(index, { ...s, field: v.value! });
                            }}
                          />
                        </InlineField>
                        <InlineField label={t('transformers.sort-by-transformer-editor.label-reverse', 'Reverse')}>
                          <InlineSwitch
                            value={!!s.desc}
                            onChange={() => {
                              onSortChange(index, { ...s, desc: !s.desc });
                            }}
                          />
                        </InlineField>
                        {hasMultipleSorts && (
                          <IconButton
                            name="trash-alt"
                            className={styles.removeButton}
                            onClick={() => onRemoveSort(index)}
                            tooltip={t(
                              'transformers.sort-by-transformer-editor.remove-sort-field',
                              'Remove sort field'
                            )}
                          />
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button size="sm" icon="plus" variant="secondary" onClick={onAddSort}>
        <Trans i18nKey="transformers.sort-by-transformer-editor.add-sort-field">Add sort field</Trans>
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'flex',
    flexDirection: 'column',
    marginBottom: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    alignItems: 'flex-start',
  }),
  dragHandle: css({
    display: 'flex',
    alignItems: 'center',
    height: theme.spacing(theme.components.height.md),
    marginRight: theme.spacing(0.5),
    cursor: 'grab',
  }),
  dragDisabled: css({
    color: theme.colors.text.disabled,
    cursor: 'default',
  }),
  removeButton: css({
    alignSelf: 'center',
    marginBottom: theme.spacing(0.5),
  }),
});
