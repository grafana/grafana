import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, useTheme2 } from '@grafana/ui';

import { fieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    dragIcon: css({
      cursor: 'drag',
      marginLeft: theme.spacing(1),
    }),
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    contentWrap: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }),
    // Making the checkbox sticky and label scrollable for labels that are wider then the container
    // However, the checkbox component does not support this, so we need to do some css hackery for now until the API of that component is updated.
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
  labels: Record<string, fieldNameMeta>;
  draggable?: boolean;
  showCount?: boolean;
}) {
  const theme = useTheme2();
  const styles = getStyles(theme);
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
          aria-label="Drag and drop icon"
          title="Drag and drop to reorder"
          name="draggabledots"
          size="lg"
          className={styles.dragIcon}
        />
      )}
    </>
  );
}
