import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import type { DashboardLink } from '@grafana/schema';
import { Box, Button, Icon, Stack, Text, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import { openAddLinkPane, openLinkEditPane } from './LinkAddEditableElement';

function partitionLinks(links: DashboardLink[]) {
  const standardLinks: Array<{ link: DashboardLink; originalIndex: number }> = [];
  const controlsMenuLinks: Array<{ link: DashboardLink; originalIndex: number }> = [];

  links.forEach((link, index) => {
    if (link.placement === 'inControlsMenu') {
      controlsMenuLinks.push({ link, originalIndex: index });
    } else {
      standardLinks.push({ link, originalIndex: index });
    }
  });

  return { standardLinks, controlsMenuLinks };
}

export function LinkList({ dashboard }: { dashboard: DashboardScene }) {
  const { links } = dashboard.useState();
  const styles = useStyles2(getStyles);

  const onSelectLink = useCallback(
    (linkIndex: number) => {
      openLinkEditPane(dashboard, linkIndex);
    },
    [dashboard]
  );

  const onAddLink = useCallback(() => {
    openAddLinkPane(dashboard);
    DashboardInteractions.addLinkButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  const { standardLinks, controlsMenuLinks } = useMemo(() => partitionLinks(links ?? []), [links]);

  const createDragEndHandler = useCallback(
    (
      sourceList: Array<{ link: DashboardLink; originalIndex: number }>,
      otherList: Array<{ link: DashboardLink; originalIndex: number }>
    ) => {
      return (result: DropResult) => {
        const currentLinks = dashboard.state.links ?? [];

        dashboardEditActions.edit({
          source: dashboard,
          description: t(
            'dashboard-scene.link-list.create-drag-end-handler.description.reorder-links-list',
            'Reorder links list'
          ),
          perform: () => {
            if (!result.destination || result.destination.index === result.source.index) {
              return;
            }

            const updatedList = [...sourceList];
            const [movedLink] = updatedList.splice(result.source.index, 1);
            updatedList.splice(result.destination.index, 0, movedLink);

            const isSourceStandard = sourceList === standardLinks;
            const merged = isSourceStandard ? [...updatedList, ...otherList] : [...otherList, ...updatedList];

            dashboard.setState({ links: merged.map((item) => item.link) });
          },
          undo: () => {
            dashboard.setState({ links: currentLinks });
          },
        });
      };
    },
    [dashboard, standardLinks]
  );

  const onStandardDragEnd = useMemo(
    () => createDragEndHandler(standardLinks, controlsMenuLinks),
    [controlsMenuLinks, createDragEndHandler, standardLinks]
  );

  const onControlsDragEnd = useMemo(
    () => createDragEndHandler(controlsMenuLinks, standardLinks),
    [controlsMenuLinks, createDragEndHandler, standardLinks]
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const renderList = (list: Array<{ link: DashboardLink; originalIndex: number }>, droppableId: string) => (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <Stack ref={provided.innerRef} {...provided.droppableProps} direction="column" gap={0}>
          {list.map((item, index) => (
            <Draggable key={`link-${item.originalIndex}`} draggableId={`link-${item.originalIndex}`} index={index}>
              {(draggableProvided) => (
                <div className={styles.linkItem} ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                  <div {...draggableProvided.dragHandleProps} onPointerDown={onPointerDown}>
                    <Tooltip content={t('dashboard.edit-pane.links.reorder', 'Drag to reorder')} placement="top">
                      <Icon name="draggabledots" size="md" className={styles.dragHandle} />
                    </Tooltip>
                  </div>
                  <div
                    className={styles.linkContent}
                    aria-label={t('dashboard-scene.link-list.render-list.aria-label-link', 'Link')}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLink(item.originalIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectLink(item.originalIndex);
                      }
                    }}
                  >
                    <Text truncate>{item.link.title || t('dashboard.edit-pane.links.untitled', 'Untitled link')}</Text>
                    {item.link.placement === 'inControlsMenu' && (
                      <Icon name="sliders-v-alt" size="sm" className={styles.hiddenIcon} />
                    )}
                    <Stack direction="row" gap={1} alignItems="center">
                      <Button variant="primary" size="sm" fill="outline">
                        <Trans i18nKey="dashboard.edit-pane.links.select-link">Select</Trans>
                      </Button>
                    </Stack>
                  </div>
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Stack>
      )}
    </Droppable>
  );

  return (
    <Stack direction="column" gap={0}>
      <DragDropContext onDragEnd={onStandardDragEnd}>
        {renderList(standardLinks, 'links-outline-standard')}
      </DragDropContext>
      {controlsMenuLinks.length > 0 && (
        <DragDropContext onDragEnd={onControlsDragEnd}>
          {renderList(controlsMenuLinks, 'links-outline-controls')}
        </DragDropContext>
      )}
      <Box paddingBottom={1} paddingTop={1} display={'flex'}>
        <Button fullWidth icon="plus" size="sm" variant="secondary" onClick={onAddLink}>
          <Trans i18nKey="dashboard.edit-pane.links.add-link">Add link</Trans>
        </Button>
      </Box>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5),
    }),
    linkContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(0.5),
      width: '100%',
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
    dragHandle: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
  };
}
