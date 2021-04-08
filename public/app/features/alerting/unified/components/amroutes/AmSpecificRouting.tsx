import React, { FC, useRef } from 'react';
import { Button, HorizontalGroup, IconButton } from '@grafana/ui';
import { Route } from '../../../../../plugins/datasource/alertmanager/types';
import { DynamicTable, DynamicTableColumnProps, DynamicTableRef } from '../DynamicTable';

export interface AmSpecificRoutingProps {
  route: Route | undefined;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({ route }) => {
  const tableRef = useRef<DynamicTableRef>(null);

  const renderMatchingCriteria = (item: Route) =>
    Object.entries({
      ...(item.match ?? {}),
      ...(item.match_re ?? {}),
    })
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

  const renderGroupBy = (item: Route) => (item.group_by ?? []).join(', ');

  const renderReceiverChannel = (item: Route) => item?.receiver;

  const renderButtons = (_item: Route, itemKey: string, _isExpanded: boolean, isAlternateContent: boolean) => {
    if (isAlternateContent) {
      return null;
    }

    return (
      <HorizontalGroup>
        <Button
          icon="pen"
          onClick={() => {
            tableRef.current?.addAlternateExpandedContentItem(itemKey);
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
      label: '',
      type: 'expand',
    },
    {
      label: 'Matching criteria',
      render: renderMatchingCriteria,
      size: 10,
      type: 'data',
    },
    {
      label: 'Group by',
      render: renderGroupBy,
      size: 5,
      type: 'data',
    },
    {
      label: 'Receiver channel',
      render: renderReceiverChannel,
      size: 5,
      type: 'data',
    },
    {
      label: 'Actions',
      render: renderButtons,
      size: 2,
      type: 'data',
    },
  ];

  const renderExpandedItem = () => 'asdf';

  const renderAlternateExpandedItem = () => '2';

  return (
    <div>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen channels, based on matching criteria</p>
      <DynamicTable
        cols={cols}
        items={route?.routes ?? []}
        renderExpandedItem={renderExpandedItem}
        renderAlternateExpandedItem={renderAlternateExpandedItem}
        ref={tableRef}
      />
    </div>
  );
};
