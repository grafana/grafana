import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Menu, Stack, Text, useStyles2, ConfirmButton, Dropdown, Icon } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
}

export function EditPaneHeader({ element }: EditPaneHeaderProps) {
  const addCopyOrDuplicate = element.onCopy || element.onDuplicate;
  const elementInfo = element.getEditableElementInfo();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Text variant="h5">{capitalize(elementInfo.typeId)}</Text>
      <Stack direction="row" gap={2}>
        {addCopyOrDuplicate ? (
          <Dropdown overlay={<MenuItems onCopy={element.onCopy} onDuplicate={element.onDuplicate} />}>
            <Button
              tooltip={t('dashboard.layout.common.copy-or-duplicate', 'Copy or Duplicate')}
              tooltipPlacement="bottom"
              variant="secondary"
              size="sm"
              icon="copy"
            >
              <Icon name="angle-down" />
            </Button>
          </Dropdown>
        ) : null}

        {element.onDelete && (
          <ConfirmButton onConfirm={element.onDelete} confirmText="Confirm" confirmVariant="destructive" size="sm">
            <Button size="sm" variant="destructive" fill="outline">
              <Trans i18nKey="dashboard.layout.common.delete" />
            </Button>
          </ConfirmButton>
        )}
      </Stack>
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
      {onCopy ? <Menu.Item icon="copy" label={t('dashboard.layout.common.copy', 'Copy')} onClick={onCopy} /> : null}
      {onDuplicate ? (
        <Menu.Item
          icon="file-copy-alt"
          label={t('dashboard.layout.common.duplicate', 'Duplicate')}
          onClick={onDuplicate}
        />
      ) : null}
    </Menu>
  );
};
