import React, { FC, useEffect, useState } from 'react';
import { Button, HorizontalGroup, IconButton } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { collapseItem, expandItem, prepareItems } from '../../utils/dynamicTable';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AmRoutesExpandedRead } from './AmRoutesExpandedRead';

export interface AmRoutesTableProps {
  routes: Route[];
}

export const AmRoutesTable: FC<AmRoutesTableProps> = ({ routes }) => {
  const [items, setItems] = useState<Array<DynamicTableItemProps<Route>>>([]);

  useEffect(() => {
    setItems(prepareItems(routes));
  }, [routes]);

  const renderMatchingCriteria = (item: DynamicTableItemProps<Route>) => (
    <AlertLabels
      labels={{
        ...(item.data.match ?? {}),
        ...(item.data.match_re ?? {}),
      }}
    />
  );

  const renderGroupBy = (item: DynamicTableItemProps<Route>) => (item.data.group_by ?? []).join(', ');

  const renderReceiverChannel = (item: DynamicTableItemProps<Route>) => item.data.receiver;

  const renderButtons = (item: DynamicTableItemProps<Route>) => {
    if (item.renderExpandedContent) {
      return null;
    }

    return (
      <HorizontalGroup>
        <Button
          icon="pen"
          onClick={() => {
            setItems(
              items.map((currentItem) => {
                if (currentItem !== item) {
                  return currentItem;
                }

                return {
                  ...currentItem,
                  isExpanded: true,
                  renderExpandedContent: () => 2,
                };
              })
            );
          }}
          size="sm"
          variant="secondary"
        >
          Edit
        </Button>
        <IconButton name="trash-alt" />
      </HorizontalGroup>
    );
  };

  const cols: Array<DynamicTableColumnProps<Route>> = [
    {
      id: 'matchingCriteria',
      label: 'Matching criteria',
      renderRow: renderMatchingCriteria,
      size: 10,
    },
    {
      id: 'groupBy',
      label: 'Group by',
      renderRow: renderGroupBy,
      size: 5,
    },
    {
      id: 'receiverChannel',
      label: 'Receiver channel',
      renderRow: renderReceiverChannel,
      size: 5,
    },
    {
      id: 'actions',
      label: 'Actions',
      renderRow: renderButtons,
      size: 2.5,
    },
  ];

  const onCollapse = (item: DynamicTableItemProps<Route>) => {
    setItems(collapseItem(items, item));
  };

  const onExpand = (item: DynamicTableItemProps<Route>) => {
    setItems(expandItem(items, item));
  };

  const renderExpandedContent = (item: DynamicTableItemProps<Route>) => <AmRoutesExpandedRead route={item.data} />;

  return (
    <DynamicTable
      cols={cols}
      isExpandable={true}
      items={items}
      onCollapse={onCollapse}
      onExpand={onExpand}
      renderExpandedContent={renderExpandedContent}
    />
  );
};
