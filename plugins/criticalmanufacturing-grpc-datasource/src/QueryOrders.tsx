import React, { PureComponent } from 'react';
import uniqueId from 'lodash/uniqueId';

import { Button, Icon, InlineFieldRow, InlineField, Select } from '@grafana/ui';
import { Orders, GetQuery, OrderDirection } from './types';
import { SelectableValue } from '@grafana/data';
import { orderDirectionInfos } from 'queryInfo';

interface State {
  orders: Orders;
};

interface OrderSettingsProps {
  query: GetQuery;
  onChange: (query: GetQuery) => void;
};

export class OrderSettings extends PureComponent<OrderSettingsProps, State> {
  state: State = {
    orders: []
  };

  constructor(props: OrderSettingsProps) {
    super(props);
    this.state = {
      orders: this.props.query.orders || []
    };
  };

  updateSettings = () => {
    const { orders } = this.state;

    this.props.onChange({
      ...this.props.query,
      orders: orders,
    });
  };

  onOrderAdd = () => {
    this.setState((prevState) => {
      return { orders: [...prevState.orders, { id: uniqueId(), field: '', direction: OrderDirection.Asc }] };
    });
  };

  onOrderFieldChange = (orderIndex: number, value: SelectableValue<string>) => {
    this.setState(({ orders }) => {
      return {
        orders: orders.map((order, i) => {
          if (orderIndex !== i) {
            return order;
          }
          return {
            ...order,
            field: value.value!
          };
        })
      };
    }, this.updateSettings);
  };

  onOrderDirectionChange = (orderIndex: number, value: SelectableValue<OrderDirection>) => {
    this.setState(({ orders }) => {
      return {
        orders: orders.map((order, i) => {
          if (orderIndex !== i) {
            return order;
          }
          return {
            ...order,
            direction: value.value!
          };
        })
      };
    }, this.updateSettings);
  };

  onOrderRemove = (orderId: string) => {
    this.setState(
      ({ orders }) => ({
        orders: orders.filter((h) => h.id !== orderId),
      }),
      this.updateSettings
    );
  };

  render() {
    const orders = this.state.orders;
    const parameterAliases: Array<SelectableValue<string>> = this.props.query.parameters?.map(p => ({ label: p.key, value: p.key })) ?? [];
    const filteredMetrics = this.props.query.metrics?.filter(m => !this.props.query.aggregations?.some(a => a.fields.some(f => f === m.metricId)));
    const metricNames: Array<SelectableValue<string>> = filteredMetrics?.map(m => ({ label: m.metricId, value: m.metricId })) ?? [];
    const dimensionKeys: Array<SelectableValue<string>> = this.props.query.dimensions?.map(d => ({ label: d.key, value: d.key })) ?? [];
    const aggregationAliases: Array<SelectableValue<string>> = this.props.query.aggregations?.map(a => ({ label: a.alias, value: a.alias })) ?? [];
    const fields: Array<SelectableValue<string>> =
      [
        { label: 'Parameters', value: 'Parameters', options: parameterAliases },
        { label: 'Dimensions', value: 'Dimensions', options: dimensionKeys },
        { label: 'Metrics', value: 'Metrics', options: metricNames },
        { label: 'Aggregations', value: 'Aggregations', options: aggregationAliases }
      ];
    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <h6>Order By</h6>
        </div>
        {orders.map((order, i) => (
          <InlineFieldRow>
            <InlineField label="Field" labelWidth={20}>
              <Select
                options={fields}
                value={order.field}
                width={25}
                onChange={(v) => {
                  this.onOrderFieldChange(i, v);
                }} />
            </InlineField>
            <InlineField label="Direction" labelWidth={20}>
              <Select
                options={orderDirectionInfos}
                value={order.direction}
                width={25}
                onChange={(v) => {
                  this.onOrderDirectionChange(i, v);
                }} />
            </InlineField>
            <Button variant="secondary" size="xs" onClick={() => this.onOrderRemove(order.id)}>
              <Icon name="trash-alt" />
            </Button>
          </InlineFieldRow>
        ))}
        <Button
          type="button"
          variant="secondary"
          icon="plus"
          onClick={() => {
            this.onOrderAdd();
          }}
        >
          Add Order
        </Button>
      </div>
    );
  }
};

export default OrderSettings;
