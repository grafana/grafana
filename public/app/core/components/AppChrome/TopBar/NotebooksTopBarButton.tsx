import { memo } from 'react';

import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import {
  CORE_NOTEBOOKS_COMPONENT_ID,
  CORE_NOTEBOOKS_COMPONENT_TITLE,
  CORE_NOTEBOOKS_PLUGIN_ID,
  useCanUseCoreNotebooksSidebar,
} from '../ExtensionSidebar/coreSidebarComponents';

export const NotebooksTopBarButton = memo(function NotebooksTopBarButton() {
  const canUse = useCanUseCoreNotebooksSidebar();
  const { dockedComponentId, setDockedComponentId } = useExtensionSidebarContext();

  if (!canUse) {
    return null;
  }

  const isOpen = dockedComponentId === CORE_NOTEBOOKS_COMPONENT_ID;

  return (
    <ToolbarButton
      iconOnly
      icon="book"
      aria-label={t('navigation.notebooks.aria-label', 'Notebooks')}
      aria-expanded={isOpen}
      variant={isOpen ? 'active' : 'default'}
      tooltip={
        isOpen
          ? t('navigation.notebooks.close-tooltip', 'Close notebooks panel')
          : t('navigation.notebooks.open-tooltip', 'Open notebooks panel')
      }
      onClick={() => {
        if (isOpen) {
          setDockedComponentId(undefined);
        } else {
          getAppEvents().publish(
            new OpenExtensionSidebarEvent({
              pluginId: CORE_NOTEBOOKS_PLUGIN_ID,
              componentTitle: CORE_NOTEBOOKS_COMPONENT_TITLE,
            })
          );
        }
      }}
    />
  );
});
