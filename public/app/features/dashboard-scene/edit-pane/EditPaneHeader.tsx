import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
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
  const { hasCopiedPanel } = useClipboardState();

  // TODO this type check here is hacky and should be replaced with a more generic solid solution
  const canPaste = element instanceof RowItem || element instanceof TabItem ? element : undefined;
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
      {element.renderActions && element.renderActions()}
      {onCopy && (
        <Button
          variant="secondary"
          size="sm"
          icon="clipboard-alt"
          data-testid={selectors.components.EditPaneHeader.copy}
          onClick={onCopy}
          tooltip={t('dashboard.layout.common.copy-tooltip', 'Copy')}
          tooltipPlacement="bottom"
        >
          <Trans i18nKey="dashboard.layout.common.copy">Copy</Trans>
        </Button>
      )}
      {onDuplicate && (
        <Button
          tooltip={t('dashboard.layout.common.duplicate', 'Duplicate')}
          tooltipPlacement="bottom"
          variant="secondary"
          size="sm"
          icon="copy"
          data-testid={selectors.components.EditPaneHeader.duplicate}
          onClick={onDuplicate}
        />
      )}
      {canPaste && hasCopiedPanel && (
        <Button
          variant="secondary"
          size="sm"
          icon="clipboard-alt"
          data-testid={selectors.components.EditPaneHeader.paste}
          onClick={() => editPane.pastePanel(editPane.getSelectedObject(), 'editPaneHeader')}
        >
          <Trans i18nKey="dashboard.layout.common.paste">Paste</Trans>
        </Button>
      )}
      {(onDelete || onConfirmDelete) && (
        <Button
          onClick={onDeleteElement}
          size="sm"
          variant="destructive"
          fill="outline"
          icon="trash-alt"
          data-testid={selectors.components.EditPaneHeader.deleteButton}
          tooltip={t('dashboard.layout.common.delete', 'Delete')}
        />
      )}
    </Sidebar.PaneHeader>
  );
}
