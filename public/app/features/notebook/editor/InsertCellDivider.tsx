import { css } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';

import { InlineDataSourcePicker } from './InlineDataSourcePicker';

interface Props {
  onInsertText: () => void;
  onInsertCode: () => void;
  onInsertViz: (datasource: DataSourceInstanceSettings) => void;
}

/**
 * Notion-style hover affordance between cells: a thin line with a "+" that inserts
 * a new text, code or visualization block at that position.
 */
export function InsertCellDivider({ onInsertText, onInsertCode, onInsertViz }: Props) {
  const styles = useStyles2(getStyles);
  const [pickingDatasource, setPickingDatasource] = useState(false);

  if (pickingDatasource) {
    return (
      <div className={styles.pickerRow}>
        <InlineDataSourcePicker
          onSelect={(ds) => {
            setPickingDatasource(false);
            onInsertViz(ds);
          }}
          onCancel={() => setPickingDatasource(false)}
        />
      </div>
    );
  }

  const menu = (
    <Menu>
      <Menu.Item icon="text-fields" label={t('notebooks.insert-divider.text', 'Text')} onClick={onInsertText} />
      <Menu.Item icon="brackets-curly" label={t('notebooks.insert-divider.code', 'Code')} onClick={onInsertCode} />
      <Menu.Item
        icon="graph-bar"
        label={t('notebooks.insert-divider.visualization', 'Visualization')}
        onClick={() => setPickingDatasource(true)}
      />
    </Menu>
  );

  return (
    <div className={styles.divider}>
      <div className={styles.line} />
      <Dropdown overlay={menu} placement="bottom-start">
        <IconButton
          name="plus-circle"
          size="sm"
          className={styles.button}
          tooltip={t('notebooks.insert-divider.tooltip', 'Insert block here')}
        />
      </Dropdown>
      <div className={styles.line} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: theme.spacing(2),
    opacity: 0,

    '&:hover, &:focus-within': {
      opacity: 1,
    },
  }),
  pickerRow: css({
    padding: theme.spacing(1, 0),
  }),
  line: css({
    flex: 1,
    height: 1,
    background: theme.colors.border.medium,
  }),
  button: css({
    color: theme.colors.text.secondary,
  }),
});
