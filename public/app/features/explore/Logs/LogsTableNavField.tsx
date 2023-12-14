import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, useTheme2 } from '@grafana/ui';

import { fieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    // Making the checkbox sticky and label scrollable for labels that are wider then the container
    // However, the checkbox component does not support this, so we need to do some css hackery for now until the API of that component is updated.
    checkboxLabel: css({
      '> :first-child': {
        position: 'sticky',
        left: 0,
        bottom: 0,
        top: 0,
      },
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
}) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <>
      <Checkbox
        className={styles.checkboxLabel}
        label={props.label}
        onChange={props.onChange}
        checked={props.labels[props.label]?.active ?? false}
      />
      <button className={styles.labelCount} onClick={props.onChange}>
        {props.labels[props.label]?.percentOfLinesWithLabel}%
      </button>
    </>
  );
}
