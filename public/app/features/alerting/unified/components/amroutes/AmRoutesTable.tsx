import { differenceWith, isEqual } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { Button, ConfirmModal, HorizontalGroup, IconButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { getNotificationsPermissions } from '../../utils/access-control';
import { matcherFieldToMatcher, parseMatchers } from '../../utils/alertmanager';
import { prepareItems } from '../../utils/dynamicTable';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { EmptyArea } from '../EmptyArea';
import { Matchers } from '../silences/Matchers';

import { AmRoutesExpandedForm } from './AmRoutesExpandedForm';
import { AmRoutesExpandedRead } from './AmRoutesExpandedRead';

export interface AmRoutesTableProps {
  isAddMode: boolean;
  onChange: (routes: FormAmRoute[]) => void;
  onCancelAdd: () => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute[];
  filters?: { queryString?: string; contactPoint?: string };
  readOnly?: boolean;
  alertManagerSourceName: string;
}

type RouteTableColumnProps = DynamicTableColumnProps<FormAmRoute>;
type RouteTableItemProps = DynamicTableItemProps<FormAmRoute>;

export const getFilteredRoutes = (routes: FormAmRoute[], labelMatcherQuery?: string, contactPointQuery?: string) => {
  const filterMatchers = parseMatchers(labelMatcherQuery ?? '');

  let filteredRoutes = routes;

  if (filterMatchers.length) {
    filteredRoutes = routes.filter((route) => {
      const routeMatchers = route.object_matchers.map(matcherFieldToMatcher);
      // Route matchers needs to include all filter matchers
      return differenceWith(filterMatchers, routeMatchers, isEqual).length === 0;
    });
  }

  if (contactPointQuery && contactPointQuery.length > 0) {
    filteredRoutes = filteredRoutes.filter((route) =>
      route.receiver.toLowerCase().includes(contactPointQuery.toLowerCase())
    );
  }

  return filteredRoutes;
};

export const updatedRoute = (routes: FormAmRoute[], updatedRoute: FormAmRoute): FormAmRoute[] => {
  const newRoutes = [...routes];
  const editIndex = newRoutes.findIndex((route) => route.id === updatedRoute.id);

  if (editIndex >= 0) {
    newRoutes[editIndex] = {
      ...newRoutes[editIndex],
      ...updatedRoute,
    };
  }
  return newRoutes;
};

export const deleteRoute = (routes: FormAmRoute[], routeId: string): FormAmRoute[] => {
  return routes.filter((route) => route.id !== routeId);
};

export const AmRoutesTable: FC<AmRoutesTableProps> = ({
  isAddMode,
  onCancelAdd,
  onChange,
  receivers,
  routes,
  filters,
  readOnly = false,
  alertManagerSourceName,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | number>();
  const permissions = getNotificationsPermissions(alertManagerSourceName);
  const canEditRoutes = contextSrv.hasPermission(permissions.update);
  const canDeleteRoutes = contextSrv.hasPermission(permissions.delete);

  const showActions = !readOnly && (canEditRoutes || canDeleteRoutes);

  const expandItem = useCallback((item: RouteTableItemProps) => setExpandedId(item.id), []);
  const collapseItem = useCallback(() => setExpandedId(undefined), []);

  const cols: RouteTableColumnProps[] = [
    {
      id: 'matchingCriteria',
      label: 'Matching labels',
      // eslint-disable-next-line react/display-name
      renderCell: (item) => {
        return item.data.object_matchers.length ? (
          <Matchers matchers={item.data.object_matchers.map(matcherFieldToMatcher)} />
        ) : (
          <span>Matches all alert instances</span>
        );
      },
      size: 10,
    },
    {
      id: 'groupBy',
      label: 'Group by',
      renderCell: (item) => (item.data.overrideGrouping && item.data.groupBy.join(', ')) || '-',
      size: 5,
    },
    {
      id: 'receiverChannel',
      label: 'Contact point',
      renderCell: (item) => item.data.receiver || '-',
      size: 5,
    },
    {
      id: 'muteTimings',
      label: 'Mute timings',
      renderCell: (item) => item.data.muteTimeIntervals.join(', ') || '-',
      size: 5,
    },
    ...(!showActions
      ? []
      : [
          {
            id: 'actions',
            label: 'Actions',
            // eslint-disable-next-line react/display-name
            renderCell: (item) => {
              if (item.renderExpandedContent) {
                return null;
              }

              const expandWithCustomContent = () => {
                expandItem(item);
                setEditMode(true);
              };

              return (
                <>
                  <HorizontalGroup>
                    <Button
                      aria-label="Edit route"
                      icon="pen"
                      onClick={expandWithCustomContent}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <IconButton
                      aria-label="Delete route"
                      name="trash-alt"
                      onClick={() => {
                        setDeletingRouteId(item.data.id);
                      }}
                      type="button"
                    />
                  </HorizontalGroup>
                </>
              );
            },
            size: '100px',
          } as RouteTableColumnProps,
        ]),
  ];

  const filteredRoutes = useMemo(
    () => getFilteredRoutes(routes, filters?.queryString, filters?.contactPoint),
    [routes, filters]
  );

  const dynamicTableRoutes = useMemo(
    () => prepareItems(isAddMode ? routes : filteredRoutes),
    [isAddMode, routes, filteredRoutes]
  );

  // expand the last item when adding or reset when the length changed
  useEffect(() => {
    if (isAddMode && dynamicTableRoutes.length) {
      setExpandedId(dynamicTableRoutes[dynamicTableRoutes.length - 1].id);
    }
    if (!isAddMode && dynamicTableRoutes.length) {
      setExpandedId(undefined);
    }
  }, [isAddMode, dynamicTableRoutes]);

  if (routes.length > 0 && filteredRoutes.length === 0) {
    return (
      <EmptyArea>
        <p>No policies found</p>
      </EmptyArea>
    );
  }

  return (
    <>
      <DynamicTable
        cols={cols}
        isExpandable={true}
        items={dynamicTableRoutes}
        testIdGenerator={() => 'am-routes-row'}
        onCollapse={collapseItem}
        onExpand={expandItem}
        isExpanded={(item) => expandedId === item.id}
        renderExpandedContent={(item: RouteTableItemProps) =>
          isAddMode || editMode ? (
            <AmRoutesExpandedForm
              onCancel={() => {
                if (isAddMode) {
                  onCancelAdd();
                }
                setEditMode(false);
              }}
              onSave={(data) => {
                const newRoutes = updatedRoute(routes, data);

                setEditMode(false);
                onChange(newRoutes);
              }}
              receivers={receivers}
              routes={item.data}
            />
          ) : (
            <AmRoutesExpandedRead
              onChange={(data) => {
                const newRoutes = updatedRoute(routes, data);
                onChange(newRoutes);
              }}
              receivers={receivers}
              routes={item.data}
              readOnly={readOnly}
              alertManagerSourceName={alertManagerSourceName}
            />
          )
        }
      />
      <ConfirmModal
        isOpen={!!deletingRouteId}
        title="Delete notification policy"
        body="Deleting this notification policy will permanently remove it. Are you sure you want to delete this policy?"
        confirmText="Yes, delete"
        icon="exclamation-triangle"
        onConfirm={() => {
          if (deletingRouteId) {
            const newRoutes = deleteRoute(routes, deletingRouteId);
            onChange(newRoutes);
            setDeletingRouteId(undefined);
          }
        }}
        onDismiss={() => setDeletingRouteId(undefined)}
      />
    </>
  );
};
