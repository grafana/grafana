import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Menu, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { TabItem } from './TabItem';

interface Props {
  model: TabItem;
}

export function TabItemSuffix({ model }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButtonRow className={styles.container}>
      <Dropdown
        placement="bottom-end"
        overlay={() => (
          <Menu>
            <Menu.Item
              ariaLabel={t('dashboard.tabs-layout.tab.suffix.add-panel', 'Panel')}
              label={t('dashboard.tabs-layout.tab.suffix.add-panel', 'Panel')}
              onClick={() => model.onAddPanel()}
            />
            <Menu.Divider />
            <Menu.Item
              ariaLabel={t('dashboard.tabs-layout.tab.suffix.add-tab-before', 'Tab before')}
              label={t('dashboard.tabs-layout.tab.suffix.add-tab-above', 'Tab before')}
              onClick={() => model.onAddTabBefore()}
            />
            <Menu.Item
              ariaLabel={t('dashboard.tabs-layout.tab.suffix.add-tab-after', 'Tab after')}
              label={t('dashboard.tabs-layout.tab.suffix.add-tab-after', 'Tab after')}
              onClick={() => model.onAddTabAfter()}
            />
          </Menu>
        )}
      >
        <ToolbarButton
          aria-label={t('dashboard.tabs-layout.tab.suffix.add', 'Add')}
          title={t('dashboard.tabs-layout.tab.suffix.add', 'Add')}
          icon="plus"
          iconSize="xs"
          variant="primary"
        />
      </Dropdown>
      <ToolbarButton
        aria-label={t('dashboard.tabs-layout.tab.suffix.delete', 'Delete')}
        title={t('dashboard.tabs-layout.tab.suffix.delete', 'Delete')}
        icon="trash-alt"
        iconSize="xs"
        variant="destructive"
        onClick={() => model.onDelete()}
      />
      {!model.isLastTab() && (
        <ToolbarButton
          aria-label={t('dashboard.tabs-layout.tab.suffix.move-right', 'Move right')}
          title={t('dashboard.tabs-layout.tab.suffix.move-right', 'Move right')}
          icon="arrow-right"
          iconSize="xs"
          variant="canvas"
          onClick={() => model.onMoveRight()}
        />
      )}
    </ToolbarButtonRow>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginLeft: theme.spacing(1),
    }),
  };
}
