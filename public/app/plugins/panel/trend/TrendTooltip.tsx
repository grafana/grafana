import { css } from '@emotion/css';
import React from 'react';

import {
  arrayUtils,
  DashboardCursorSync,
  DataFrame,
  FALLBACK_COLOR,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
} from '@grafana/data';
import { TooltipDisplayMode, SortOrder } from '@grafana/schema';
import { SeriesTableRowProps, useStyles2, useTheme2 } from '@grafana/ui';
import { SeriesList } from '@grafana/ui/src/components/VizTooltip/SeriesList';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { LabelValue } from '@grafana/ui/src/components/VizTooltip/types';

interface TrendTooltipProps {
  frames?: DataFrame[];
  // aligned data frame
  data: DataFrame;
  // config: UPlotConfigBuilder;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;
  sync?: () => DashboardCursorSync;

  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx: number | null;
  isPinned: boolean;
}

export const TrendTooltip = ({
  frames,
  data,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  sync,
  dataIdxs,
  seriesIdx,
  isPinned,
}: TrendTooltipProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const xField = data.fields[0];
  if (!xField) {
    return null;
  }

  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, theme });
  let xVal = xFieldFmt(xField!.values[dataIdxs[0]!]).text;
  let tooltip: React.ReactNode = null;

  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  // Single mode
  if (mode === TooltipDisplayMode.Single || isPinned) {
    const field = data.fields[seriesIdx!];

    if (!field) {
      return null;
    }

    const dataIdx = dataIdxs[seriesIdx!]!;
    xVal = xFieldFmt(xField!.values[dataIdx]).text;
    const fieldFmt = field.display || getDisplayProcessor({ field, theme });
    const display = fieldFmt(field.values[dataIdx]);

    if (field.getLinks) {
      const v = field.values[dataIdx];
      const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
      field.getLinks({ calculatedValue: disp, valueRowIndex: dataIdx }).forEach((link) => {
        const key = `${link.title}/${link.href}`;
        if (!linkLookup.has(key)) {
          links.push(link);
          linkLookup.add(key);
        }
      });
    }

    tooltip = (
      <SeriesList
        series={[
          {
            color: display.color || FALLBACK_COLOR,
            label: getFieldDisplayName(field, data, frames),
            value: display ? formattedValueToString(display) : null,
          },
        ]}
      />
    );
  }

  if (mode === TooltipDisplayMode.Multi && !isPinned) {
    let series: SeriesTableRowProps[] = [];
    const frame = data;
    const fields = frame.fields;
    const sortIdx: unknown[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = frame.fields[i];
      if (
        !field ||
        field === xField ||
        field.type === FieldType.time ||
        field.type !== FieldType.number ||
        field.config.custom?.hideFrom?.tooltip ||
        field.config.custom?.hideFrom?.viz
      ) {
        continue;
      }

      const v = data.fields[i].values[dataIdxs[i]!];
      const display = field.display!(v);

      sortIdx.push(v);
      series.push({
        color: display.color || FALLBACK_COLOR,
        label: field.state?.displayName ?? field.name,
        value: display ? formattedValueToString(display) : null,
        isActive: seriesIdx === i,
      });
    }

    if (sortOrder !== SortOrder.None) {
      // create sort reference series array, as Array.sort() mutates the original array
      const sortRef = [...series];
      const sortFn = arrayUtils.sortValues(sortOrder);

      series.sort((a, b) => {
        // get compared values indices to retrieve raw values from sortIdx
        const aIdx = sortRef.indexOf(a);
        const bIdx = sortRef.indexOf(b);
        return sortFn(sortIdx[aIdx], sortIdx[bIdx]);
      });
    }

    tooltip = <SeriesList series={series} />;
  }

  const getHeaderLabel = (): LabelValue => {
    return {
      label: getFieldDisplayName(xField, data),
      value: xVal,
    };
  };

  return (
    <div>
      <div className={styles.wrapper}>
        <VizTooltipHeader headerLabel={getHeaderLabel()} customValueDisplay={tooltip} />
        {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={false} />}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
  }),
});
