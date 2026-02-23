import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Menu, Stack, Dropdown, Icon, Sidebar } from '@grafana/ui';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../utils/interactions';

import { DashboardEditPane } from './DashboardEditPane';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
  editPane: DashboardEditPane;
}

export function EditPaneHeader({ element, editPane }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();

  const onCopy = element.onCopy?.bind(element);
  const onDuplicate = element.onDuplicate?.bind(element);
  const onDelete = element.onDelete?.bind(element);
  const onConfirmDelete = element.onConfirmDelete?.bind(element);

  const onDeleteElement = () => {
    if (onConfirmDelete) {
      onConfirmDelete();
    } else if (onDelete) {
      onDelete();
    }
    DashboardInteractions.trackDeleteDashboardElement(elementInfo.typeName);
  };

  return (
    <Sidebar.PaneHeader title={elementInfo.typeName}>
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
              data-testid={selectors.components.EditPaneHeader.copyDropdown}
            >
              <Icon name="angle-down" />
            </Button>
          </Dropdown>
        )}

        {(onDelete || onConfirmDelete) && (
          <Button
            onClick={onDeleteElement}
            size="sm"
            variant="destructive"
            fill="outline"
            icon="trash-alt"
            tooltip={t('dashboard.layout.common.delete', 'Delete')}
            data-testid={selectors.components.EditPaneHeader.deleteButton}
          />
        )}
      </Stack>
    </Sidebar.PaneHeader>
  );
}
