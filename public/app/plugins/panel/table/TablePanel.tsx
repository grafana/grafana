import { css } from '@emotion/css';
import React, { Component } from 'react';

import {
  DataFrame,
  FieldMatcherID,
  getDataSourceRef,
  getFrameDisplayName,
  PanelProps,
  SelectableValue,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Select, Table } from '@grafana/ui';
import { FilterItem, TableSortByFieldState } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { applyFilterFromTable } from '../../../features/variables/adhoc/actions';
import { dispatch } from '../../../store/store';

import { PanelOptions } from './models.gen';

interface Props extends PanelProps<PanelOptions> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  onColumnResize = (fieldDisplayName: string, width: number) => {
    const { fieldConfig } = this.props;
    const { overrides } = fieldConfig;

    const matcherId = FieldMatcherID.byName;
    const propId = 'custom.width';

    // look for existing override
    const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);

    if (override) {
      // look for existing property
      const property = override.properties.find((prop) => prop.id === propId);
      if (property) {
        property.value = width;
      } else {
        override.properties.push({ id: propId, value: width });
      }
    } else {
      overrides.push({
        matcher: { id: matcherId, options: fieldDisplayName },
        properties: [{ id: propId, value: width }],
      });
    }

    this.props.onFieldConfigChange({
      ...fieldConfig,
      overrides,
    });
  };

  onSortByChange = (sortBy: TableSortByFieldState[]) => {
    this.props.onOptionsChange({
      ...this.props.options,
      sortBy,
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

  onCellFilterAdded = (filter: FilterItem) => {
    const { key, value, operator } = filter;
    const panelModel = getDashboardSrv().getCurrent()?.getPanelById(this.props.id);
    if (!panelModel) {
      return;
    }

    // When the datasource is null/undefined (for a default datasource), we use getInstanceSettings
    // to find the real datasource ref for the default datasource.
    const datasourceInstance = getDatasourceSrv().getInstanceSettings(panelModel.datasource);
    const datasourceRef = datasourceInstance && getDataSourceRef(datasourceInstance);
    if (!datasourceRef) {
      return;
    }

    dispatch(applyFilterFromTable({ datasource: datasourceRef, key, operator, value }));
  };

  renderTable(frame: DataFrame, width: number, height: number, subData?: DataFrame[]) {
    const { options } = this.props;

    return (
      <Table
        height={height}
        width={width}
        data={frame}
        noHeader={!options.showHeader}
        showTypeIcons={options.showTypeIcons}
        resizable={true}
        initialSortBy={options.sortBy}
        onSortByChange={this.onSortByChange}
        onColumnResize={this.onColumnResize}
        onCellFilterAdded={this.onCellFilterAdded}
        footerOptions={options.footer}
        enablePagination={options.footer?.enablePagination}
        subData={subData}
      />
    );
  }

  getCurrentFrameIndex(frames: DataFrame[], options: PanelOptions) {
    return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
  }

  render() {
    const { data, height, width, options, fieldConfig, id } = this.props;

    const frames = data.series;
    const mainFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex === undefined);
    const subFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex !== undefined);
    const count = mainFrames?.length;
    const hasFields = mainFrames[0]?.fields.length;

    if (!count || !hasFields) {
      return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
    }

    if (count > 1) {
      const inputHeight = config.theme2.spacing.gridSize * config.theme2.components.height.md;
      const padding = 8 * 2;
      const currentIndex = this.getCurrentFrameIndex(mainFrames, options);
      const names = mainFrames.map((frame, index) => {
        return {
          label: getFrameDisplayName(frame),
          value: index,
        };
      });

      const main = mainFrames[currentIndex];
      const subData = subFrames.filter((f) => f.refId === main.refId);
      return (
        <div className={tableStyles.wrapper}>
          {this.renderTable(main, width, height - inputHeight - padding, subData)}
          <div className={tableStyles.selectWrapper}>
            <Select options={names} value={names[currentIndex]} onChange={this.onChangeTableSelection} />
          </div>
        </div>
      );
    }

    const subData = frames.filter((f) => f.meta?.custom?.parentRowIndex !== undefined);
    return this.renderTable(data.series[0], width, height, subData);
  }
}

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  noData: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px;
  `,
};
