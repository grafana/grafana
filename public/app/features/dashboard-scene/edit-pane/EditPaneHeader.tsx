import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Menu, Stack, Text, useStyles2, Dropdown, Icon, IconButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { DashboardEditPane } from './DashboardEditPane';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
  editPane: DashboardEditPane;
}

export function EditPaneHeader({ element, editPane }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();
  const styles = useStyles2(getStyles);

  const onCopy = element.onCopy?.bind(element);
  const onDuplicate = element.onDuplicate?.bind(element);
  const onDelete = element.onDelete?.bind(element);
  const onConfirmDelete = element.onConfirmDelete?.bind(element);
  // temporary simple solution, should select parent element
  const onGoBack = () => editPane.clearSelection();
  const canGoBack = editPane.state.selection;

  return (
    <div className={styles.wrapper}>
      <Stack direction="row" gap={1}>
        {canGoBack && (
          <IconButton
            name="arrow-left"
            size="lg"
            onClick={onGoBack}
            tooltip={t('grafana.dashboard.edit-pane.go-back', 'Go back')}
            aria-label={t('grafana.dashboard.edit-pane.go-back', 'Go back')}
          />
        )}
        <Text>{elementInfo.typeName}</Text>
      </Stack>
      <Stack direction="row" gap={1}>
        {element.renderActions && element.renderActions()}
        {(onCopy || onDuplicate) && (
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

        {(onDelete || onConfirmDelete) && (
          <Button
            onClick={onConfirmDelete || onDelete}
            size="sm"
            variant="destructive"
            fill="outline"
            icon="trash-alt"
            tooltip={t('dashboard.layout.common.delete', 'Delete')}
          />
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
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
