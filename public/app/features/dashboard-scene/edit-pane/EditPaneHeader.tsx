import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Menu, Stack, Text, useStyles2, ConfirmButton, Dropdown, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
}

export function EditPaneHeader({ element }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();
  const styles = useStyles2(getStyles);

  const onCopy = element.onCopy?.bind(element);
  const onDuplicate = element.onDuplicate?.bind(element);
  const onDelete = element.onDelete?.bind(element);

  return (
    <div className={styles.wrapper}>
      <Text variant="h5">{elementInfo.typeName}</Text>
      <Stack direction="row" gap={1}>
        {element.renderActions && element.renderActions()}
        {(onCopy || onDelete) && (
          <Dropdown
            overlay={
              <Menu>
                {onCopy ? (
                  <Menu.Item icon="copy" label={t('dashboard.layout.common.copy', 'Copy')} onClick={onCopy} />
                ) : null}
                {onDuplicate ? (
                  <Menu.Item
                    icon="file-copy-alt"
                    label={t('dashboard.layout.common.duplicate', 'Duplicate')}
                    onClick={onDuplicate}
                  />
                ) : null}
              </Menu>
            }
          >
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
        )}

        {onDelete && (
          <ConfirmButton
            onConfirm={onDelete}
            confirmText="Confirm"
            confirmVariant="destructive"
            size="sm"
            closeOnConfirm={true}
          >
            <Button
              size="sm"
              variant="destructive"
              fill="outline"
              icon="trash-alt"
              tooltip={t('dashboard.layout.common.delete', 'Delete')}
            />
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
