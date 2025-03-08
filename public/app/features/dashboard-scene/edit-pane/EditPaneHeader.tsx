import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { Dropdown, Button, IconButton, Menu, Stack, Icon, Box, Text, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

interface EditPaneHeaderProps {
  element: EditableDashboardElement | MultiSelectedEditableDashboardElement;
}

export function EditPaneHeader({ element }: EditPaneHeaderProps) {
  // const addCopyOrDuplicate = onCopy || onDuplicate;
  const elementInfo = element.getEditableElementInfo();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Text variant="h5">{capitalize(elementInfo.typeId)}</Text>
      {/* <Stack alignItems="center">
        {addCopyOrDuplicate ? (
          <Dropdown overlay={<MenuItems onCopy={onCopy} onDuplicate={onDuplicate} />}>
            <Button
              tooltip={t('dashboard.layout.common.copy-or-duplicate', 'Copy or Duplicate')}
              tooltipPlacement="bottom"
              variant="secondary"
              fill="text"
              size="md"
            >
              <Icon name="copy" /> <Icon name="angle-down" />
            </Button>
          </Dropdown>
        ) : null} */}

      {/* <IconButton
          size="md"
          variant="secondary"
          onClick={onDelete}
          name="trash-alt"
          tooltip={t('dashboard.layout.common.delete', 'Delete')}
        />
      </Stack> */}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}

type MenuItemsProps = {
  onCopy?: () => void;
  onDuplicate?: () => void;
};

const MenuItems = ({ onCopy, onDuplicate }: MenuItemsProps) => {
  return (
    <Menu>
      {onCopy ? <Menu.Item label={t('dashboard.layout.common.copy', 'Copy')} onClick={onCopy} /> : null}
      {onDuplicate ? (
        <Menu.Item label={t('dashboard.layout.common.duplicate', 'Duplicate')} onClick={onDuplicate} />
      ) : null}
    </Menu>
  );
};
