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
import { VizPanelEditableElement } from './VizPanelEditableElement';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
  sidebar: DashboardSidebar;
}

export function ElementEditPaneHeader({ element, sidebar }: EditPaneHeaderProps) {
  const elementInfo = element.getEditableElementInfo();
  const { hasCopiedPanel } = useClipboardState();

  // TODO this type check here is hacky and should be replaced with a more generic solid solution
  const canPaste = element instanceof RowItem || element instanceof TabItem ? element : undefined;
  // Copying is withheld from a plan preview (see planningPolicy), so the button goes with it rather
  // than sitting there inert. Checked here because this header derives its buttons from which
  // methods an element happens to expose, and the element cannot un-expose one per dashboard state.
  const canCopy = element instanceof VizPanelEditableElement ? element.isCopyAllowed() : true;
  const onCopy = canCopy ? element.onCopy?.bind(element) : undefined;
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
      {(onDelete || onConfirmDelete) && (
        <>
          <FlexItem grow={1} />
          <Button
            onClick={onDeleteElement}
            size="sm"
            variant="secondary"
            icon="trash-alt"
            fill="text"
            data-testid={selectors.components.EditPaneHeader.deleteButton}
            tooltip={t('dashboard.sidebar.element-actions.delete', 'Delete')}
          >
            <Trans i18nKey="dashboard.sidebar.element-actions.delete">Delete</Trans>
          </Button>
        </>
      )}
    </Sidebar.PaneHeader>
  );
}
