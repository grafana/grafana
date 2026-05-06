import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type DashboardLink, type DashboardLinkPlacement } from '@grafana/schema/dist/esm/index.gen';
import { Box, Button } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddLinkPane, openLinkEditPane } from '../../settings/links/LinkAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';
import { dashboardEditActions } from '../shared';

import { DraggableList } from './DraggableList';

const ID_VISIBLE_LIST = 'links-list-visible';
const ID_CONTROLS_MENU_LIST = 'links-list-controls-menu';

const DROPPABLE_TO_PLACEMENT: Record<string, DashboardLinkPlacement | undefined> = {
  [ID_VISIBLE_LIST]: undefined,
  [ID_CONTROLS_MENU_LIST]: 'inControlsMenu',
};

export function DashboardLinksList({ dashboard }: { dashboard: DashboardScene }) {
  const { links } = dashboard.useState();
  const { visible, controlsMenu } = useMemo(() => partitionLinksByPlacement(links), [links]);

  const onClickLink = useCallback(
    (link: PseudoSceneLink) => {
      openLinkEditPane(dashboard, Number(link.state.key));
    },
    [dashboard]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) {
        return;
      }

      const isSameList = source.droppableId === destination.droppableId;
      if (isSameList && source.index === destination.index) {
        return;
      }

      const currentLinks = dashboard.state.links;
      const lists: Record<string, PseudoSceneLink[]> = {
        [ID_VISIBLE_LIST]: [...visible],
        [ID_CONTROLS_MENU_LIST]: [...controlsMenu],
      };

      const sourceList = lists[source.droppableId];
      const destList = isSameList ? sourceList : lists[destination.droppableId];

      const [moved] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moved);

      const newPlacement = DROPPABLE_TO_PLACEMENT[destination.droppableId];

      dashboardEditActions.edit({
        source: dashboard,
        description: t('dashboard-scene.links-list.drag-end-description', 'Reorder links list'),
        perform: () => {
          const reorderedLinks = [...lists[ID_VISIBLE_LIST], ...lists[ID_CONTROLS_MENU_LIST]].map((l) => {
            const { state: _, ...link } = l;
            const placement = l === moved ? newPlacement : l.placement;
            return { ...link, placement };
          });
          dashboard.setState({ links: reorderedLinks });
        },
        undo: () => {
          dashboard.setState({ links: currentLinks });
        },
      });
    },
    [dashboard, visible, controlsMenu]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_VISIBLE_LIST}
        title={t('dashboard-scene.links-list.title-above-dashboard', 'Above dashboard ({{count}})', {
          count: visible.length,
        })}
        onClickItem={onClickLink}
        renderItemLabel={renderItemLabel}
      />
      <DraggableList
        items={controlsMenu}
        droppableId={ID_CONTROLS_MENU_LIST}
        title={t('dashboard-scene.links-list.title-controls-menu', 'Controls menu ({{count}})', {
          count: controlsMenu.length,
        })}
        onClickItem={onClickLink}
        renderItemLabel={renderItemLabel}
      />
    </DragDropContext>
  );
}

const renderItemLabel = (l: DashboardLink) => <span data-testid="link-title">{l.title}</span>;

export function AddLinkButton({ dashboard }: { dashboard: DashboardScene }) {
  const onAddLink = useCallback(() => {
    openAddLinkPane(dashboard);
    DashboardInteractions.addLinkButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  return (
    <Box display="flex" paddingTop={1} paddingBottom={1}>
      <Button
        fullWidth
        icon="plus"
        size="sm"
        variant="secondary"
        onClick={onAddLink}
        data-testid={selectors.components.PanelEditor.ElementEditPane.addLinkButton}
      >
        <Trans i18nKey="dashboard-scene.dashboard-links-list.add-link">Add link</Trans>
      </Button>
    </Box>
  );
}

// we make links Scene-like for DraggableList
type PseudoSceneLink = DashboardLink & { state: { key: string; name: string } };

export function partitionLinksByPlacement(links: DashboardLink[]) {
  const visible: PseudoSceneLink[] = [];
  const controlsMenu: PseudoSceneLink[] = [];

  links.forEach((link, index) => {
    // we make links Scene-like for DraggableList
    if (link.placement === 'inControlsMenu') {
      controlsMenu.push({ ...link, state: { key: String(index), name: link.title } });
    } else {
      visible.push({ ...link, state: { key: String(index), name: link.title } });
    }
  });

  return { visible, controlsMenu };
}
