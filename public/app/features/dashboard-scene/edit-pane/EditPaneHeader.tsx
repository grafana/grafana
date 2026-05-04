import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Menu, Stack, Dropdown, Icon, Sidebar } from '@grafana/ui';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { useClipboardState } from '../scene/layouts-shared/useClipboardState';
import { type EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../utils/interactions';

import { type DashboardEditPane } from './DashboardEditPane';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
  editPane: DashboardEditPane;
}

export function EditPaneHeader({ element, editPane }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();
  const { hasCopiedPanel, hasCopiedRow, hasCopiedTab } = useClipboardState();

  // TODO this type check here is hacky and should be replaced with a more generic solid solution
  const pasteTarget = element instanceof RowItem || element instanceof TabItem ? element : undefined;
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
    <Sidebar.PaneHeader title={elementInfo.typeName} onGoBack={editPane.getOnGetBackCallback()}>
      <Stack direction="row" gap={1} grow={1} justifyContent={'flex-end'}>
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
                {pasteTarget && hasCopiedPanel ? (
                  <Menu.Item
                    icon="clipboard-alt"
                    label={t('dashboard.layout.common.paste', 'Paste')}
                    onClick={() => editPane.pastePanel(editPane.getSelectedObject(), 'editPaneHeader')}
                    data-testid={selectors.components.EditPaneHeader.paste}
                  />
                ) : null}
                {pasteTarget && hasCopiedRow ? (
                  <Menu.Item
                    icon="clipboard-alt"
                    label={t('dashboard.layout.common.paste-row', 'Paste row')}
                    onClick={() => editPane.pasteRow(pasteTarget)}
                  />
                ) : null}
                {pasteTarget && hasCopiedTab ? (
                  <Menu.Item
                    icon="clipboard-alt"
                    label={t('dashboard.layout.common.paste-tab', 'Paste tab')}
                    onClick={() => editPane.pasteTab(pasteTarget)}
                  />
                ) : null}
              </Menu>
            }
          >
            <Button
              tooltip={t('dashboard.layout.common.copy-or-duplicate', 'Copy/paste or duplicate')}
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
