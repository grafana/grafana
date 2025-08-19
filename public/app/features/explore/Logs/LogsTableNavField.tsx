import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, useTheme2 } from '@grafana/ui';

import { FieldNameMeta } from './LogsTableWrap';

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

export function LogsTableNavField(props: {
  label: string;
  onChange: () => void;
  labels: Record<string, FieldNameMeta>;
  draggable?: boolean;
  showCount?: boolean;
}): React.JSX.Element | undefined {
  const theme = useTheme2();

  const styles = getStyles(theme);

  if (props.labels[props.label]) {
    return (
      <>
        <div className={styles.contentWrap}>
          <Checkbox
            className={styles.checkboxLabel}
            label={props.label}
            onChange={props.onChange}
            checked={props.labels[props.label]?.active ?? false}
          />
          {props.showCount && (
            <button className={styles.labelCount} onClick={props.onChange}>
              {props.labels[props.label]?.percentOfLinesWithLabel}%
            </button>
          )}
        </div>
        {props.draggable && (
          <Icon
            aria-label={t('explore.logs-table-nav-field.aria-label-drag-and-drop-icon', 'Drag and drop icon')}
            title={t('explore.logs-table-nav-field.title-drag-and-drop-to-reorder', 'Drag and drop to reorder')}
            name="draggabledots"
            size="lg"
            className={styles.dragIcon}
          />
        )}
      </>
    );
  }
  return undefined;
}
