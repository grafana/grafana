import { css } from '@emotion/css';
import React from 'react';

import { AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, DeleteButton, IconButton, TextLink, useStyles2, VerticalGroup } from '@grafana/ui';
import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { t, Trans } from 'app/core/internationalization';
import { ListNewButton } from 'app/features/dashboard/components/DashboardSettings/ListNewButton';

import { MoveDirection } from '../AnnotationsEditView';

type Props = {
  annotations: AnnotationQuery[];
  onNew: () => void;
  onEdit: (idx: number) => void;
  onMove: (idx: number, dir: MoveDirection) => void;
  onDelete: (idx: number) => void;
};

export const BUTTON_TITLE = t('annotations.empty-state.button-title', 'Add annotation query');

export const AnnotationSettingsList = ({ annotations, onNew, onEdit, onMove, onDelete }: Props) => {
  const styles = useStyles2(getStyles);

  const showEmptyListCTA = annotations.length === 0 || (annotations.length === 1 && annotations[0].builtIn);

  const getAnnotationName = (anno: AnnotationQuery) => {
    if (anno.enable === false) {
      return <em className="muted">(Disabled) &nbsp; {anno.name}</em>;
    }

    if (anno.builtIn) {
      return <em className="muted">{anno.name} &nbsp; (Built-in)</em>;
    }

    return <>{anno.name}</>;
  };

  const dataSourceSrv = getDataSourceSrv();
  return (
    <VerticalGroup>
      {annotations.length > 0 && (
        <div className={styles.table}>
          <table role="grid" className="filter-table filter-table--hover">
            <thead>
              <tr>
                <th>Query name</th>
                <th>Data source</th>
                <th colSpan={3}></th>
              </tr>
            </thead>
            <tbody data-testid={selectors.pages.Dashboard.Settings.Annotations.List.annotations}>
              {annotations.map((annotation, idx) => (
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
                      <IconButton name="arrow-up" onClick={() => onMove(idx, MoveDirection.UP)} tooltip="Move up" />
                    )}
                  </td>
                  <td role="gridcell" style={{ width: '1%' }}>
                    {annotations.length > 1 && idx !== annotations.length - 1 ? (
                      <IconButton
                        name="arrow-down"
                        onClick={() => onMove(idx, MoveDirection.DOWN)}
                        tooltip="Move down"
                      />
                    ) : null}
                  </td>
                  <td role="gridcell" style={{ width: '1%' }}>
                    {!annotation.builtIn && (
                      <DeleteButton
                        size="sm"
                        onConfirm={() => onDelete(idx)}
                        aria-label={`Delete query with title "${annotation.name}"`}
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
        <EmptyState
          message={t('annotations.empty-state.title', 'There are no custom annotation queries added yet')}
          buttonLabel={BUTTON_TITLE}
          onButtonClick={onNew}
        >
          <Alert severity="info" title={t('annotations.empty-state.info-box-title', 'What are annotation queries?')}>
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
              <TextLink external href="">
                Annotations documentation
              </TextLink>{' '}
              for more information.
            </Trans>
          </Alert>
        </EmptyState>
      )}
      {!showEmptyListCTA && (
        <ListNewButton
          data-testid={selectors.pages.Dashboard.Settings.Annotations.List.addAnnotationCTAV2}
          onClick={onNew}
        >
          New query
        </ListNewButton>
      )}
    </VerticalGroup>
  );
};

const getStyles = () => ({
  table: css({
    width: '100%',
    overflowX: 'scroll',
  }),
});
