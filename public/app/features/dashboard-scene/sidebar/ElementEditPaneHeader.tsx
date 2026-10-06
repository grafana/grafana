import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { FlexItem } from '@grafana/plugin-ui';
import { Button, Sidebar } from '@grafana/ui';
import { getLayoutType } from 'app/features/dashboard/utils/tracking';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { useClipboardState } from '../scene/layouts-shared/useClipboardState';
import { type EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../utils/interactions';

import { type DashboardSidebar } from './DashboardSidebar';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
  sidebar: DashboardSidebar;
}

export function ElementEditPaneHeader({ element, sidebar }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();
  const { hasCopiedPanel } = useClipboardState();

  // TODO this type check here is hacky and should be replaced with a more generic solid solution
  const canPaste = element instanceof RowItem || element instanceof TabItem ? element : undefined;
  const readOnly = element.isReadOnly === true;
  const onCopy = element.onCopy?.bind(element);
  const onDuplicate = readOnly ? undefined : element.onDuplicate?.bind(element);
  const onDelete = readOnly ? undefined : element.onDelete?.bind(element);
  const onConfirmDelete = readOnly ? undefined : element.onConfirmDelete?.bind(element);
  const onRemove = readOnly ? element.onRemove?.bind(element) : undefined;

  const onDeleteElement = () => {
    if (onConfirmDelete) {
      onConfirmDelete();
    } else if (onDelete) {
      onDelete();
    }
    DashboardInteractions.trackDeleteDashboardElement(elementInfo.typeName);
  };

  const onRemoveElement = () => {
    onRemove?.();
    DashboardInteractions.trackDeleteDashboardElement(elementInfo.typeName);
  };

  return (
    <Sidebar.PaneHeader title={elementInfo.typeName}>
      {element.renderActions && element.renderActions()}
      {onDuplicate && (
        <Button
          tooltip={t('dashboard.sidebar.element-actions.duplicate', 'Duplicate')}
          tooltipPlacement="bottom"
          variant="secondary"
          size="sm"
          icon="copy"
          fill="text"
          data-testid={selectors.components.EditPaneHeader.duplicate}
          onClick={() => onDuplicate()}
        >
          <Trans i18nKey="dashboard.sidebar.element-actions.duplicate">Duplicate</Trans>
        </Button>
      )}
      {onCopy && (
        <Button
          variant="secondary"
          size="sm"
          icon="clipboard-alt"
          fill="text"
          data-testid={selectors.components.EditPaneHeader.copy}
          onClick={() => onCopy()}
          tooltip={t('dashboard.sidebar.element-actions.copy-tooltip', 'Copy')}
          tooltipPlacement="bottom"
        >
          <Trans i18nKey="dashboard.sidebar.element-actions.copy">Copy</Trans>
        </Button>
      )}
      {canPaste && hasCopiedPanel && (
        <Button
          variant="secondary"
          size="sm"
          icon="clipboard-alt"
          fill="text"
          data-testid={selectors.components.EditPaneHeader.paste}
          onClick={() => {
            const target = sidebar.getSelectedObject();
            sidebar.pastePanel(target);
            DashboardInteractions.trackPastePanelClick('editPaneHeader', getLayoutType(target), 'click');
          }}
        >
          <Trans i18nKey="dashboard.sidebar.element-actions.paste">Paste</Trans>
        </Button>
      )}
      {(onDelete || onConfirmDelete || onRemove) && (
        <>
          <FlexItem grow={1} />
          <Button
            onClick={onRemove ? onRemoveElement : onDeleteElement}
            size="sm"
            variant="secondary"
            icon="trash-alt"
            fill="text"
            data-testid={selectors.components.EditPaneHeader.deleteButton}
            tooltip={
              onRemove
                ? t('dashboard.sidebar.element-actions.remove', 'Remove')
                : t('dashboard.sidebar.element-actions.delete', 'Delete')
            }
          >
            {onRemove ? (
              <Trans i18nKey="dashboard.sidebar.element-actions.remove">Remove</Trans>
            ) : (
              <Trans i18nKey="dashboard.sidebar.element-actions.delete">Delete</Trans>
            )}
          </Button>
        </>
      )}
    </Sidebar.PaneHeader>
  );
}
