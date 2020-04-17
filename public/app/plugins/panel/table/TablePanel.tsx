import React, { Component } from 'react';

import { Table, Select } from '@grafana/ui';
import { Field, FieldMatcherID, PanelProps, DataFrame, SelectableValue } from '@grafana/data';
import { Options } from './types';
import { css } from 'emotion';
import { config } from 'app/core/config';

interface Props extends PanelProps<Options> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  onColumnResize = (field: Field, width: number) => {
    const current = this.props.fieldConfig;
    const matcherId = FieldMatcherID.byName;
    const prop = 'width';
    const overrides = current.overrides.filter(
      o => o.matcher.id !== matcherId || o.matcher.options !== field.name || o.properties[0].id !== prop
    );

    overrides.push({
      matcher: { id: matcherId, options: field.name },
      properties: [{ id: prop, value: width }],
    });

    this.props.onFieldConfigChange({
      ...current,
      overrides,
    });
  };

  onChangeTableSelection = (val: SelectableValue<number>) => {
    this.props.onOptionsChange({
      ...this.props.options,
      frameIndex: val.value || 0,
    });

    // Force a redraw -- but no need to re-query
    this.forceUpdate();
  };

  renderTable(frame: DataFrame, width: number, height: number) {
    const {
      options: { showHeader, resizable },
    } = this.props;
    return <Table height={height} width={width} data={frame} noHeader={!showHeader} resizable={resizable} />;
  }

  render() {
    const {
      data,
      height,
      width,
      options: { frameIndex },
    } = this.props;

    const count = data.series?.length;

    if (!count || count < 1) {
      return <div>No data</div>;
    }

    if (count > 1) {
      const inputHeight = config.theme.spacing.formInputHeight;
      const padding = 8 * 2;
      const index = frameIndex > 0 && frameIndex < count ? frameIndex : 0;
      const names = data.series.map((frame, index) => {
        return {
          label: `${frame.name ?? 'Series'}`,
          value: index,
        };
      });

      return (
        <div className={tableStyles.wrapper}>
          {this.renderTable(data.series[index], width, height - inputHeight - padding)}
          <div className={tableStyles.selectWrapper}>
            <Select options={names} value={names[index]} onChange={this.onChangeTableSelection} />
          </div>
        </div>
      );
    }

    return this.renderTable(data.series[0], width, height - 12);
  }
}

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px;
  `,
};
