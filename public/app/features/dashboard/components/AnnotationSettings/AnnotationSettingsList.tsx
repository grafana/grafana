import React, { useState } from 'react';

import { arrayUtils, AnnotationQuery } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DeleteButton, Icon, IconButton, VerticalGroup } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

import { DashboardModel } from '../../state/DashboardModel';
import { ListNewButton } from '../DashboardSettings/ListNewButton';

type Props = {
  dashboard: DashboardModel;
  onNew: () => void;
  onEdit: (idx: number) => void;
};

export const AnnotationSettingsList = ({ dashboard, onNew, onEdit }: Props) => {
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
          <Icon name="times" /> &nbsp;<em className="muted">(Disabled) &nbsp; {anno.name}</em>
        </>
      );
    }

    if (anno.builtIn) {
      return (
        <>
          <Icon name="comment-alt" /> &nbsp;<em className="muted">{anno.name} (Built-in)</em>
        </>
      );
    }

    return (
      <>
        <Icon name="comment-alt" /> &nbsp;{anno.name}
      </>
    );
  };

  const dataSourceSrv = getDataSourceSrv();
  return (
    <VerticalGroup>
      {annotations.length > 0 && (
        <table role="grid" className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Query name</th>
              <th>Data source</th>
              <th colSpan={3}></th>
            </tr>
          </thead>
          <tbody>
            {dashboard.annotations.list.map((annotation, idx) => (
              <tr key={`${annotation.name}-${idx}`}>
                {annotation.builtIn ? (
                  <td role="gridcell" style={{ width: '90%' }} className="pointer" onClick={() => onEdit(idx)}>
                    {getAnnotationName(annotation)}
                  </td>
                ) : (
                  <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                    {getAnnotationName(annotation)}
                  </td>
                )}
                <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                  {dataSourceSrv.getInstanceSettings(annotation.datasource)?.name || annotation.datasource?.uid}
                </td>
                <td role="gridcell" style={{ width: '1%' }}>
                  {idx !== 0 && <IconButton name="arrow-up" aria-label="arrow-up" onClick={() => onMove(idx, -1)} />}
                </td>
                <td role="gridcell" style={{ width: '1%' }}>
                  {dashboard.annotations.list.length > 1 && idx !== dashboard.annotations.list.length - 1 ? (
                    <IconButton name="arrow-down" aria-label="arrow-down" onClick={() => onMove(idx, 1)} />
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
      )}
      {showEmptyListCTA && (
        <EmptyListCTA
          onClick={onNew}
          title="There are no custom annotation queries added yet"
          buttonIcon="comment-alt"
          buttonTitle="Add annotation query"
          infoBoxTitle="What are annotation queries?"
          infoBox={{
            __html: `<p>Annotations provide a way to integrate event data into your graphs. They are visualized as vertical lines
          and icons on all graph panels. When you hover over an annotation icon you can get event text &amp; tags for
          the event. You can add annotation events directly from grafana by holding CTRL or CMD + click on graph (or
          drag region). These will be stored in Grafana's annotation database.
        </p>
        Checkout the
        <a class='external-link' target='_blank' href='http://docs.grafana.org/reference/annotations/'
          >Annotations documentation</a
        >
        for more information.`,
          }}
        />
      )}
      {!showEmptyListCTA && <ListNewButton onClick={onNew}>New query</ListNewButton>}
    </VerticalGroup>
  );
};
