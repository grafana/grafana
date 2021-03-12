import React, { useState } from 'react';
import { DeleteButton, Icon, IconButton, Tag, useTheme } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { arrayMove } from 'app/core/utils/arrayMove';
import { DashboardModel } from '../../state/DashboardModel';

type Props = {
  dashboard: DashboardModel;
  onNew: () => void;
  onEdit: (idx: number) => void;
};

export const AnnotationSettingsList: React.FC<Props> = ({ dashboard, onNew, onEdit }) => {
  // @ts-ignore
  const [renderCounter, setRenderCounter] = useState(0);

  const onMove = (idx: number, direction: number) => {
    arrayMove(dashboard.annotations.list, idx, idx + direction);
    setRenderCounter((renderCount) => renderCount + 1);
  };

  const onDelete = (idx: number) => {
    dashboard.annotations.list.splice(idx, 1);
    dashboard.updateSubmenuVisibility();
    setRenderCounter((renderCount) => renderCount + 1);
  };

  return (
    <div>
      {dashboard.annotations.list.length === 1 ? (
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
      ) : (
        <table className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Query name</th>
              <th>Data source</th>
              <th colSpan={3}></th>
            </tr>
          </thead>
          <tbody>
            {dashboard.annotations.list.map((annotation, idx) => (
              <tr key={`${annotation.name}-idx`}>
                {!annotation.builtIn && (
                  <td className="pointer" onClick={() => onEdit(idx)}>
                    <Icon name="comment-alt" /> &nbsp; {annotation.name}
                  </td>
                )}
                {annotation.builtIn && (
                  <td
                    style={{ width: '90%' }}
                    ng-show="annotation.builtIn"
                    className="pointer"
                    onClick={() => onEdit(idx)}
                  >
                    <Icon name="comment-alt" /> &nbsp; <em className="muted">{annotation.name} (Built-in)</em>
                  </td>
                )}
                <td className="pointer" onClick={() => onEdit(idx)}>
                  {annotation.datasource || 'Default'}
                </td>
                <td style={{ width: '1%' }}>
                  {idx !== 0 && (
                    <IconButton
                      surface="header"
                      name="arrow-up"
                      aria-label="arrow-up"
                      onClick={() => onMove(idx, -1)}
                    />
                  )}
                </td>
                <td style={{ width: '1%' }}>
                  {dashboard.links.length > 1 && idx !== dashboard.links.length - 1 ? (
                    <IconButton
                      surface="header"
                      name="arrow-down"
                      aria-label="arrow-down"
                      onClick={() => onMove(idx, 1)}
                    />
                  ) : null}
                </td>
                <td style={{ width: '1%' }}>
                  <DeleteButton size="sm" onConfirm={() => onDelete(idx)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
