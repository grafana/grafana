import { css } from '@emotion/css';
import { type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import * as React from 'react';
import { useCallback, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { getNormalizedFieldName } from '../panel/processing';

import { type FieldWithStats } from './FieldSelector';
import { FieldValues } from './FieldValues';
import { fieldSupportsValues, useFieldValuesContext } from './FieldValuesContext';

interface Props {
  active?: boolean;
  field: FieldWithStats;
  toggle(key: string): void;
  draggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  showCount?: boolean;
}

export function Field({
  active = false,
  draggable = false,
  dragHandleProps,
  field,
  toggle,
  showCount = false,
}: Props): React.JSX.Element | undefined {
  const styles = useStyles2(getStyles);
  const fieldValues = useFieldValuesContext();
  const valuesId = useId();

  const handleChange = useCallback(() => {
    reportInteraction('logs_field_selector_toggle_fields_clicked', {
      active,
    });
    toggle(field.name);
  }, [active, field.name, toggle]);

  const dragIcon = (
    <Icon
      aria-label={t('logs.field-selector.aria-label-drag-and-drop-icon', 'Drag and drop icon')}
      title={t('logs.field-selector.title-drag-and-drop-to-reorder', 'Drag and drop to reorder')}
      name="draggabledots"
      size="lg"
      className={styles.dragIcon}
    />
  );

  if (fieldValues && fieldSupportsValues(field.name)) {
    const expanded = fieldValues.expandedFields.has(field.name);
    const fieldName = getNormalizedFieldName(field.name);
    return (
      <div className={styles.expandableField}>
        <div className={styles.contentWrap}>
          <Checkbox
            aria-label={t('logs.field-selector.aria-label-show-field', 'Show {{fieldName}} in log lines', {
              fieldName,
            })}
            onChange={handleChange}
            checked={active}
          />
          <button
            type="button"
            className={styles.expandButton}
            aria-expanded={expanded}
            aria-controls={expanded ? valuesId : undefined}
            title={t('logs.field-selector.label-title', `{{fieldName}} appears in {{percentage}}% of log lines`, {
              fieldName,
              percentage: field.stats.percentOfLinesWithLabel,
            })}
            onClick={() => {
              reportInteraction('logs_field_selector_expand_field_values_clicked', {
                expanded: !expanded,
                mode: 'logs',
              });
              fieldValues.toggleFieldExpanded(field.name);
            }}
          >
            <Icon name={expanded ? 'angle-down' : 'angle-right'} />
            <span className={styles.fieldName}>{fieldName}</span>
            {showCount && <span className={styles.labelCount}>{field.stats.percentOfLinesWithLabel}%</span>}
          </button>
          {draggable && <span {...dragHandleProps}>{dragIcon}</span>}
        </div>
        {expanded && <FieldValues field={field.name} id={valuesId} logs={fieldValues.logs} />}
      </div>
    );
  }

  return (
    <>
      <div className={styles.contentWrap}>
        <Checkbox
          className={styles.checkboxLabel}
          label={getNormalizedFieldName(field.name)}
          onChange={handleChange}
          checked={active}
        />
        {showCount && (
          <button className={styles.labelCount} onClick={handleChange}>
            {field.stats.percentOfLinesWithLabel}%
          </button>
        )}
      </div>
      {draggable && dragIcon}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dragIcon: css({
      cursor: 'drag',
      marginLeft: theme.spacing(1),
      opacity: 0.4,
    }),
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
      opacity: 0.6,
    }),
    expandableField: css({
      flex: 1,
      minWidth: 0,
    }),
    expandButton: css({
      alignItems: 'center',
      appearance: 'none',
      background: 'none',
      border: 'none',
      borderRadius: theme.shape.radius.default,
      color: 'inherit',
      display: 'flex',
      flex: 1,
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
      minWidth: 0,
      padding: 0,
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    fieldName: css({
      flex: 1,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      textAlign: 'left',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    contentWrap: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }),
    // Hide text that overflows, had to select elements within the Checkbox component, so this is a bit fragile
    checkboxLabel: css({
      '> span': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        maxWidth: '100%',
      },
    }),
  };
}
