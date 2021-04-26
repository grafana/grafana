import { SelectableValue } from '@grafana/data';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { Button, HorizontalGroup, IconButton } from '@grafana/ui';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { collapseItem, expandItem, prepareItems } from '../../utils/dynamicTable';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AmRoutesExpandedForm } from './AmRoutesExpandedForm';
import { AmRoutesExpandedRead } from './AmRoutesExpandedRead';

export interface AmRoutesTableProps {
  receivers: Array<SelectableValue<Receiver['name']>>;
  routes: AmRouteFormValues[];

  isAddMode?: boolean;
  onRemoveRoute?: (index: number) => void;
}

type RouteTableColumnProps = DynamicTableColumnProps<AmRouteFormValues>;
type RouteTableItemProps = DynamicTableItemProps<AmRouteFormValues>;

export const AmRoutesTable: FC<AmRoutesTableProps> = ({ isAddMode, onRemoveRoute, routes, receivers }) => {
  const [items, setItems] = useState<RouteTableItemProps[]>([]);

  const getRenderEditExpandedContent = useCallback(
    // eslint-disable-next-line react/display-name
    (item: RouteTableItemProps) => () => (
      <AmRoutesExpandedForm
        onExitEditMode={() => setItems((items) => expandItem(items, item))}
        routes={item.data}
        receivers={receivers!}
      />
    ),
    [receivers]
  );

  const cols: RouteTableColumnProps[] = [
    {
      id: 'matchingCriteria',
      label: 'Matching criteria',
      // eslint-disable-next-line react/display-name
      renderRow: (item) => (
        <AlertLabels
          labels={item.data.matchers.reduce(
            (acc, matcher) => ({
              ...acc,
              [matcher.label]: matcher.value,
            }),
            {}
          )}
        />
      ),
      size: 10,
    },
    {
      id: 'groupBy',
      label: 'Group by',
      renderRow: (item) => item.data.groupBy.map((groupBy) => groupBy.label).join(', ') || '-',
      size: 5,
    },
    {
      id: 'receiverChannel',
      label: 'Receiver channel',
      renderRow: (item) => item.data.receiver || '-',
      size: 5,
    },
    {
      id: 'actions',
      label: 'Actions',
      // eslint-disable-next-line react/display-name
      renderRow: (item, index) => {
        if (item.renderExpandedContent) {
          return null;
        }

        const expandWithCustomContent = () =>
          setItems((items) => expandItem(items, item, getRenderEditExpandedContent(item)));

        return (
          <HorizontalGroup>
            <Button icon="pen" onClick={expandWithCustomContent} size="sm" type="button" variant="secondary">
              Edit
            </Button>
            <IconButton name="trash-alt" onClick={() => onRemoveRoute!(index)} type="button" />
          </HorizontalGroup>
        );
      },
      size: '100px',
    },
  ];

  useEffect(() => {
    const items = prepareItems(routes).map((item, index, arr) => {
      if (isAddMode && index === arr.length - 1) {
        return {
          ...item,
          isExpanded: true,
          renderExpandedContent: getRenderEditExpandedContent(item),
        };
      }

      return {
        ...item,
        isExpanded: false,
        renderExpandedContent: undefined,
      };
    });

    setItems(items);
  }, [routes, getRenderEditExpandedContent, isAddMode]);

  return (
    <DynamicTable
      cols={cols}
      isExpandable={true}
      items={items}
      onCollapse={(item: RouteTableItemProps) => setItems((items) => collapseItem(items, item))}
      onExpand={(item: RouteTableItemProps) => setItems((items) => expandItem(items, item))}
      renderExpandedContent={(item: RouteTableItemProps) => (
        <AmRoutesExpandedRead receivers={receivers} routes={item.data} />
      )}
    />
  );
};
