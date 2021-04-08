import React, { FC, useState } from 'react';
import { Button, HorizontalGroup, IconButton } from '@grafana/ui';
import { Route } from '../../../../../plugins/datasource/alertmanager/types';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

export interface AmSpecificRoutingProps {
  route: Route | undefined;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({ route }) => {
  const [items, setItems] = useState<Array<DynamicTableItemProps<Route>>>(
    (route?.routes ?? []).map((currentRoute, index) => ({
      id: index,
      data: currentRoute,
    }))
  );

  const renderMatchingCriteria = (item: DynamicTableItemProps<Route>) =>
    Object.entries({
      ...(item.data.match ?? {}),
      ...(item.data.match_re ?? {}),
    })
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

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
      size: 2,
    },
  ];

  const onCollapse = (item: DynamicTableItemProps<Route>) => {
    setItems(
      items.map((currentItem) => {
        if (currentItem !== item) {
          return currentItem;
        }

        return {
          ...currentItem,
          isExpanded: false,
        };
      })
    );
  };

  const onExpand = (item: DynamicTableItemProps<Route>) => {
    setItems(
      items.map((currentItem) => {
        if (currentItem !== item) {
          return currentItem;
        }

        return {
          ...currentItem,
          isExpanded: true,
        };
      })
    );
  };

  return (
    <div>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen channels, based on matching criteria</p>
      <DynamicTable
        cols={cols}
        isExpandable={true}
        items={items}
        onCollapse={onCollapse}
        onExpand={onExpand}
        renderExpandedContent={() => 1}
      />
    </div>
  );
};
