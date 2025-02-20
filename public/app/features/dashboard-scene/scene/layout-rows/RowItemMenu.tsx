import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Menu, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { RowItem } from './RowItem';

interface RowItemMenuProps {
  model: RowItem;
}

export function RowItemMenu({ model }: RowItemMenuProps) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButtonRow className={styles.container}>
      <Dropdown
        placement="bottom-end"
        overlay={() => (
          <Menu>
            <Menu.Item
              ariaLabel={t('dashboard.rows-layout.row.menu.add-panel', 'Panel')}
              label={t('dashboard.rows-layout.row.menu.add-panel', 'Panel')}
              onClick={() => model.onAddPanel()}
            />
            <Menu.Divider />
            <Menu.Item
              ariaLabel={t('dashboard.rows-layout.row.menu.add-row-above', 'Row above')}
              label={t('dashboard.rows-layout.row.menu.add-row-above', 'Row above')}
              onClick={() => model.onAddRowAbove()}
            />
            <Menu.Item
              ariaLabel={t('dashboard.rows-layout.row.menu.add-row-below', 'Row below')}
              label={t('dashboard.rows-layout.row.menu.add-row-below', 'Row below')}
              onClick={() => model.onAddRowBelow()}
            />
          </Menu>
        )}
      >
        <ToolbarButton
          aria-label={t('dashboard.rows-layout.row.menu.add', 'Add')}
          title={t('dashboard.rows-layout.row.menu.add', 'Add')}
          icon="plus"
          iconSize="sm"
          variant="primary"
        >
          <Trans i18nKey="dashboard.rows-layout.row.menu.add">Add</Trans>
        </ToolbarButton>
      </Dropdown>
      <ToolbarButton
        aria-label={t('dashboard.rows-layout.row.menu.delete', 'Delete')}
        title={t('dashboard.rows-layout.row.menu.delete', 'Delete')}
        icon="trash-alt"
        iconSize="sm"
        variant="destructive"
        onClick={() => model.onDelete()}
      />
      {!model.isFirstRow() && (
        <ToolbarButton
          aria-label={t('dashboard.rows-layout.row.menu.move-up', 'Move up')}
          title={t('dashboard.rows-layout.row.menu.move-up', 'Move up')}
          icon="arrow-up"
          iconSize="sm"
          variant="canvas"
          onClick={() => model.onMoveUp()}
        />
      )}
      {!model.isLastRow() && (
        <ToolbarButton
          aria-label={t('dashboard.rows-layout.row.menu.move-down', 'Move down')}
          title={t('dashboard.rows-layout.row.menu.move-down', 'Move down')}
          icon="arrow-down"
          iconSize="sm"
          variant="canvas"
          onClick={() => model.onMoveDown()}
        />
      )}
    </ToolbarButtonRow>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  }),
});
