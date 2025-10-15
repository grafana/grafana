import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';

import { FieldWithStats } from './FieldSelector';

interface Props {
  active?: boolean;
  field: FieldWithStats;
  toggle(key: string): void;
  draggable?: boolean;
  showCount?: boolean;
}

export function Field({
  active = false,
  draggable = false,
  field,
  toggle,
  showCount = false,
}: Props): React.JSX.Element | undefined {
  const styles = useStyles2(getStyles);

  const handleChange = useCallback(() => {
    toggle(field.name);
  }, [field.name, toggle]);

  return (
    <>
      <div className={styles.contentWrap}>
        <Checkbox className={styles.checkboxLabel} label={field.name} onChange={handleChange} checked={active} />
        {showCount && (
          <button className={styles.labelCount} onClick={handleChange}>
            {field.stats.percentOfLinesWithLabel}%
          </button>
        )}
      </div>
      {draggable && (
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
