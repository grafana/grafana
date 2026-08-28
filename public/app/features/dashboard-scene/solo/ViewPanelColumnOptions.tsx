import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2, type PanelData } from '@grafana/data';
import { createOrderFieldsComparer, type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Box, Icon, IconButton, Text, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { getAllFieldNamesFromDataFrames } from 'app/features/transformers/utils';

import { type ViewPanelSidePane } from './ViewPanelSidePane';

export interface Props {
  panel: VizPanel;
  pane: ViewPanelSidePane;
}

export function ViewPanelColumnOptions({ panel, pane }: Props) {
  const { adhocTransforms } = pane.useState();
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const styles = useStyles2(getStyles);

  const organize = adhocTransforms?.organize ?? defaultOrganizeOptions;
  const { excludeByName, indexByName } = organize;

  useEffect(() => {
    const dataProvider = panel.state.$data;

    if (!dataProvider) {
      return;
    }

    const dataSub = dataProvider.subscribeToState((state) => {
      setFieldNames(extractFieldNamesFromData(state.data));
    });

    setFieldNames(extractFieldNamesFromData(dataProvider.state.data));

    return () => dataSub.unsubscribe();
  }, [panel]);

  const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);

  const onToggleVisibility = useCallback(
    (fieldName: string, isVisible: boolean) => {
      pane.onChangeOrganizeOptions({
        ...organize,
        excludeByName: { ...excludeByName, [fieldName]: isVisible },
      });
    },
    [pane, organize, excludeByName]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      pane.onChangeOrganizeOptions({
        ...organize,
        indexByName: reorderToIndex(orderedFieldNames, startIndex, endIndex),
      });
    },
    [pane, organize, orderedFieldNames]
  );

  return (
    <OptionsPaneCategory
      title={t('dashboard.sidebar.view-panel.columns-category', 'Columns')}
      id="columns"
      isOpenDefault={true}
    >
      {orderedFieldNames.length === 0 && (
        <Box paddingLeft={1}>
          <Text italic variant="bodySmall">
            {t('dashboard.sidebar.view-panel.columns-no-fields', 'Data has no fields')}
          </Text>
        </Box>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="view-panel-columns" direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} className={styles.droppableList} {...provided.droppableProps}>
              {orderedFieldNames.map((fieldName, index) => (
                <DraggableFieldName
                  key={fieldName}
                  fieldName={fieldName}
                  index={index}
                  visible={!excludeByName[fieldName]}
                  onToggleVisibility={onToggleVisibility}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </OptionsPaneCategory>
  );
}

interface DraggableFieldNameProps {
  fieldName: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
}

function DraggableFieldName({ fieldName, index, visible, onToggleVisibility }: DraggableFieldNameProps) {
  const styles = useStyles2(getStyles);

  return (
    <Draggable draggableId={fieldName} index={index}>
      {(provided) => (
        <div className={styles.fieldRow} ref={provided.innerRef} {...provided.draggableProps}>
          <span {...provided.dragHandleProps} className={styles.dragHandle}>
            <Icon
              name="draggabledots"
              title={t('dashboard.sidebar.view-panel.columns-drag-to-reorder', 'Drag and drop to reorder')}
              size="lg"
              className={styles.draggable}
            />
          </span>
          <IconButton
            className={styles.toggle}
            size="md"
            name={visible ? 'eye' : 'eye-slash'}
            onClick={() => onToggleVisibility(fieldName, visible)}
            tooltip={
              visible
                ? t('dashboard.sidebar.view-panel.columns-hide', 'Hide {{fieldName}}', {
                    fieldName,
                    interpolation: { escapeValue: false },
                  })
                : t('dashboard.sidebar.view-panel.columns-show', 'Show {{fieldName}}', {
                    fieldName,
                    interpolation: { escapeValue: false },
                  })
            }
          />
          <Text truncate={true} element="p" variant="bodySmall" weight="bold">
            {fieldName}
          </Text>
        </div>
      )}
    </Draggable>
  );
}

const defaultOrganizeOptions: OrganizeFieldsTransformerOptions = {
  excludeByName: {},
  indexByName: {},
  renameByName: {},
};

function extractFieldNamesFromData(panelData: PanelData | undefined): string[] {
  if (!panelData) {
    return [];
  }

  return Array.from(new Set(getAllFieldNamesFromDataFrames(panelData.series)));
}

function orderFieldNamesByIndex(fieldNames: string[], indexByName: Record<string, number> = {}): string[] {
  if (Object.keys(indexByName).length === 0) {
    return fieldNames;
  }

  return [...fieldNames].sort(createOrderFieldsComparer(indexByName));
}

function reorderToIndex(fieldNames: string[], startIndex: number, endIndex: number): Record<string, number> {
  const result = Array.from(fieldNames);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result.reduce<Record<string, number>>((indexByName, fieldName, index) => {
    indexByName[fieldName] = index;
    return indexByName;
  }, {});
}

const getStyles = (theme: GrafanaTheme2) => ({
  droppableList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  fieldRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    overflow: 'hidden',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    height: theme.spacing(theme.components.height.md),
    padding: theme.spacing(0, 1),
  }),
  dragHandle: css({
    display: 'flex',
    alignItems: 'center',
  }),
  toggle: css({
    color: theme.colors.text.secondary,
  }),
  draggable: css({
    opacity: 0.4,
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
});
