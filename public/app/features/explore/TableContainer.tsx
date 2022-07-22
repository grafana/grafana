import React, { PureComponent } from 'react';

import { ValueLinkConfig, applyFieldOverrides, TimeZone, DataFrame, SplitOpen, TimeRange } from '@grafana/data';
import { Collapse, Table } from '@grafana/ui';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';

import { MetaInfoText } from './MetaInfoText';
import { getFieldLinksForExplore } from './utils/links';

interface TableContainerProps {
  data: DataFrame;
  ariaLabel?: string;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: FilterItem) => void;
  loading: boolean;
  splitOpen: SplitOpen;
  range: TimeRange;
}

type Props = TableContainerProps;

export default class TableContainer extends PureComponent<Props> {
  getTableHeight() {
    const { data } = this.props;

    if (!data || data.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, data.length * 35) + 35);
  }

  render() {
    const { loading, onCellFilterAdded, data, width, splitOpen, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

    let dataFrame = data;
    if (data?.length) {
      dataFrame = applyFieldOverrides({
        data: [data],
        timeZone,
        theme: config.theme2,
        replaceVariables: (v: string) => v,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })[0];
      // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
      // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
      // differently and sidestep this getLinks API on a dataframe
      for (const field of dataFrame.fields) {
        field.getLinks = (config: ValueLinkConfig) => {
          return getFieldLinksForExplore({
            field,
            rowIndex: config.valueRowIndex!,
            splitOpenFn: splitOpen,
            range,
            dataFrame: dataFrame!,
          });
        };
      }
    }

    return (
      <Collapse label="Table" loading={loading} isOpen>
        {dataFrame?.length ? (
          <Table
            ariaLabel={ariaLabel}
            data={dataFrame}
            width={tableWidth}
            height={height}
            onCellFilterAdded={onCellFilterAdded}
          />
        ) : (
          <MetaInfoText metaItems={[{ value: '0 series returned' }]} />
        )}
      </Collapse>
    );
  }
}
