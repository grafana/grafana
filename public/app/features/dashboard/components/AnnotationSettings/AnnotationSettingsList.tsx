import { css } from '@emotion/css';
import { useState } from 'react';

import { arrayUtils, AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, DeleteButton, EmptyState, IconButton, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { DashboardModel } from '../../state/DashboardModel';
import { ListNewButton } from '../DashboardSettings/ListNewButton';

type Props = {
  dashboard: DashboardModel;
  onNew: () => void;
  onEdit: (idx: number) => void;
};

export const AnnotationSettingsList = ({ dashboard, onNew, onEdit }: Props) => {
  const styles = useStyles2(getStyles);
  const [annotations, updateAnnotations] = useState(dashboard.annotations.list);

  const onMove = (idx: number, direction: number) => {
    dashboard.annotations.list = arrayUtils.moveItemImmutably(annotations, idx, idx + direction);
    updateAnnotations(dashboard.annotations.list);
  };

  const onDelete = (idx: number) => {
    dashboard.annotations.list = [...annotations.slice(0, idx), ...annotations.slice(idx + 1)];
    updateAnnotations(dashboard.annotations.list);
  };

  const showEmptyListCTA = annotations.length === 0 || (annotations.length === 1 && annotations[0].builtIn);

  const getAnnotationName = (anno: AnnotationQuery) => {
    if (anno.enable === false) {
      return (
        <>
          <em className="muted">
            <Trans i18nKey="dashboard.annotation-settings-list.disabled" values={{ name: anno.name }}>
              (Disabled) {'{{name}}'}
            </Trans>
          </em>
        </>
      );
    }

    if (anno.builtIn) {
      return (
        <>
          <em className="muted">
            <Trans i18nKey="dashboard.annotation-settings-list.built-in" values={{ name: anno.name }}>
              {'{{name}}'} (Built-in)
            </Trans>
          </em>
        </>
      );
    }

    return <>{anno.name}</>;
  };

  const dataSourceSrv = getDataSourceSrv();
  return (
    <Stack direction="column">
      {annotations.length > 0 && (
        <div className={styles.table}>
          <table role="grid" className="filter-table filter-table--hover">
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="dashboard.annotation-settings-list.query-name">Query name</Trans>
                </th>
                <th>
                  <Trans i18nKey="dashboard.annotation-settings-list.data-source">Data source</Trans>
                </th>
                <th colSpan={3}></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.annotations.list.map((annotation, idx) => (
                <tr key={`${annotation.name}-${idx}`}>
                  {annotation.builtIn ? (
                    <td role="gridcell" style={{ width: '90%' }} className="pointer" onClick={() => onEdit(idx)}>
                      <Button size="sm" fill="text" variant="secondary">
                        {getAnnotationName(annotation)}
                      </Button>
                    </td>
                  ) : (
                    <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                      <Button size="sm" fill="text" variant="secondary">
                        {getAnnotationName(annotation)}
                      </Button>
                    </td>
                  )}
                  <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                    {dataSourceSrv.getInstanceSettings(annotation.datasource)?.name || annotation.datasource?.uid}
                  </td>
                  <td role="gridcell" style={{ width: '1%' }}>
                    {idx !== 0 && (
                      <IconButton
                        name="arrow-up"
                        onClick={() => onMove(idx, -1)}
                        tooltip={t('dashboard.annotation-settings-list.tooltip-move-up', 'Move up')}
                      />
                    )}
                  </td>
                  <td role="gridcell" style={{ width: '1%' }}>
                    {dashboard.annotations.list.length > 1 && idx !== dashboard.annotations.list.length - 1 ? (
                      <IconButton
                        name="arrow-down"
                        onClick={() => onMove(idx, 1)}
                        tooltip={t('dashboard.annotation-settings-list.tooltip-move-down', 'Move down')}
                      />
                    ) : null}
                  </td>
                  <td role="gridcell" style={{ width: '1%' }}>
                    {!annotation.builtIn && (
                      <DeleteButton
                        size="sm"
                        onConfirm={() => onDelete(idx)}
                        aria-label={t(
                          'dashboard.annotation-settings-list.aria-label-delete',
                          'Delete query with title "{{title}}"',
                          { title: annotation.name }
                        )}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showEmptyListCTA && (
        <Stack direction="column">
          <EmptyState
            variant="call-to-action"
            button={
              <Button
                data-testid={selectors.components.CallToActionCard.buttonV2('Add annotation query')}
                icon="comment-alt"
                onClick={onNew}
                size="lg"
              >
                <Trans i18nKey="annotations.empty-state.button-title">Add annotation query</Trans>
              </Button>
            }
            message={t('annotations.empty-state.title', 'There are no custom annotation queries added yet')}
          >
            <Trans i18nKey="annotations.empty-state.info-box-content">
              <p>
                Annotations provide a way to integrate event data into your graphs. They are visualized as vertical
                lines and icons on all graph panels. When you hover over an annotation icon you can get event text &amp;
                tags for the event. You can add annotation events directly from grafana by holding CTRL or CMD + click
                on graph (or drag region). These will be stored in Grafana&apos;s annotation database.
              </p>
            </Trans>
            <Trans i18nKey="annotations.empty-state.info-box-content-2">
              Checkout the{' '}
              <TextLink external href="http://docs.grafana.org/reference/annotations/">
                Annotations documentation
              </TextLink>{' '}
              for more information.
            </Trans>
          </EmptyState>
        </Stack>
      )}
      {!showEmptyListCTA && (
        <ListNewButton
          data-testid={selectors.pages.Dashboard.Settings.Annotations.List.addAnnotationCTAV2}
          onClick={onNew}
        >
          <Trans i18nKey="dashboard.annotation-settings-list.new-query">New query</Trans>
        </ListNewButton>
      )}
    </Stack>
  );
};

const getStyles = () => ({
  table: css({
    width: '100%',
    overflowX: 'scroll',
  }),
});
