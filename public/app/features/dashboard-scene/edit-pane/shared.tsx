import { useSessionStorage } from 'react-use';

import { SceneGridRow, SceneObject, VizPanel } from '@grafana/scenes';
import { Dropdown, Button, IconButton, Stack, Icon, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DashboardScene } from '../scene/DashboardScene';
import { SceneGridRowEditableElement } from '../scene/layout-default/SceneGridRowEditableElement';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { DashboardEditableElement } from './DashboardEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditPaneCollapsed() {
  return useSessionStorage('grafana.dashboards.edit-pane.isCollapsed', false);
}

interface RenderTitleProps {
  title: string;
  onDelete?: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
}

export const renderTitle = ({ title, onDelete, onCopy, onDuplicate }: RenderTitleProps) => {
  const addCopyOrDuplicate = onCopy || onDuplicate;
  return (
    <Stack justifyContent="space-between" alignItems="center" width="100%">
      <span>{title}</span>
      <Stack alignItems="center">
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
        ) : null}

        <IconButton
          size="md"
          variant="secondary"
          onClick={onDelete}
          name="trash-alt"
          tooltip={t('dashboard.layout.common.delete', 'Delete')}
        />
      </Stack>
    </Stack>
  );
};

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

export function getEditableElementFor(sceneObj: SceneObject | undefined): EditableDashboardElement | undefined {
  if (!sceneObj) {
    return undefined;
  }

  if (isEditableDashboardElement(sceneObj)) {
    return sceneObj;
  }

  if (sceneObj instanceof VizPanel) {
    return new VizPanelEditableElement(sceneObj);
  }

  if (sceneObj instanceof SceneGridRow) {
    return new SceneGridRowEditableElement(sceneObj);
  }

  if (sceneObj instanceof DashboardScene) {
    return new DashboardEditableElement(sceneObj);
  }

  return undefined;
}

export function hasEditableElement(sceneObj: SceneObject | undefined): boolean {
  if (!sceneObj) {
    return false;
  }

  if (
    isEditableDashboardElement(sceneObj) ||
    sceneObj instanceof VizPanel ||
    sceneObj instanceof SceneGridRow ||
    sceneObj instanceof DashboardScene
  ) {
    return true;
  }

  return false;
}
