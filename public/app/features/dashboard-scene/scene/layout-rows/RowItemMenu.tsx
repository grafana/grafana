import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Menu, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { RowItem } from './RowItem';

interface RowItemMenuProps {
  model: RowItem;
}

export function RowItemMenu({ model }: RowItemMenuProps) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButtonRow className={cx(styles.container, 'dashboard-canvas-add-button')}>
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
        <Button
          aria-label={t('dashboard.rows-layout.row.menu.add', 'Add row')}
          title={t('dashboard.rows-layout.row.menu.add', 'Add row')}
          tooltip={t('dashboard.rows-layout.row.menu.add', 'Add row')}
          icon="plus"
          size="sm"
          variant="secondary"
        >
          <Trans i18nKey="grafana-ui.tags-input.add">Add</Trans>
        </Button>
      </Dropdown>
      <Dropdown
        placement="bottom-end"
        overlay={() => (
          <Menu>
            <Menu.Item
              aria-label={t('dashboard.rows-layout.row.menu.move-up', 'Move row up')}
              label={t('dashboard.rows-layout.row.menu.move-up', 'Move row up')}
              onClick={() => model.onMoveUp()}
              disabled={model.isFirstRow()}
            />
            <Menu.Divider />
            <Menu.Item
              aria-label={t('dashboard.rows-layout.row.menu.move-down', 'Move row down')}
              label={t('dashboard.rows-layout.row.menu.move-down', 'Move row down')}
              onClick={() => model.onMoveDown()}
              disabled={model.isLastRow()}
            />
          </Menu>
        )}
      >
        <Button
          aria-label={t('dashboard.rows-layout.row.menu.move-row', 'Move row')}
          title={t('dashboard.rows-layout.row.menu.move-row', 'Move row')}
          tooltip={t('dashboard.rows-layout.row.menu.move-row', 'Move row')}
          icon="arrows-v"
          size="sm"
          variant="secondary"
        />
      </Dropdown>
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
