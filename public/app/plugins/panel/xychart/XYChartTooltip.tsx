import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, Field, getFieldDisplayName, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { findField } from '../../../features/dimensions';

import { Options, SeriesMapping } from './panelcfg.gen';
import { ExtraFacets, ScatterSeries, YValue } from './types';
import { fmt } from './utils';

export interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  isPinned: boolean;
  dismiss: () => void;
  options: Options;
  data: DataFrame[]; // source data
  allSeries: ScatterSeries[];
}

export const XYChartTooltip = ({ dataIdxs, seriesIdx, data, allSeries, dismiss, options, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  const rowIndex = dataIdxs.find((idx) => idx !== null);
  const seriesIndex = dataIdxs.findIndex((idx) => idx != null);
  const hoveredPointIndex = seriesIndex - 1;

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);

  // collect data links
  let links: Array<LinkModel<Field>> = [];
  if (yField.getLinks) {
    const v = yField.values[rowIndex];
    const disp = yField.display ? yField.display(v) : { text: `${v}`, numeric: +v };
    links = yField.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).map((linkModel) => {
      if (!linkModel.title) {
        linkModel.title = getTitleFromHref(linkModel.href);
      }

      return linkModel;
    });
  }

  // collect extra fields
  let extraFields: Field[] = frame.fields.filter((f) => f !== xField && f !== yField);
  let seriesMapping = options.seriesMapping;
  const manualSeriesConfigs = options.series;

  let extraFacets: ExtraFacets | null = null;
  if (seriesMapping === SeriesMapping.Manual && manualSeriesConfigs) {
    const colorFacetFieldName = manualSeriesConfigs[hoveredPointIndex]?.pointColor?.field ?? '';
    const sizeFacetFieldName = manualSeriesConfigs[hoveredPointIndex]?.pointSize?.field ?? '';

    const colorFacet = colorFacetFieldName ? findField(frame, colorFacetFieldName) : undefined;
    const sizeFacet = sizeFacetFieldName ? findField(frame, sizeFacetFieldName) : undefined;

    extraFacets = {
      colorFacetFieldName,
      sizeFacetFieldName,
      colorFacetValue: colorFacet?.values[rowIndex],
      sizeFacetValue: sizeFacet?.values[rowIndex],
    };

    extraFields = extraFields.filter((f) => f !== colorFacet && f !== sizeFacet);
  }

  // get Y value
  let yValue: YValue | null = null;
  yValue = {
    name: getFieldDisplayName(yField, frame),
    val: yField.values[rowIndex],
    field: yField,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    color: series.pointColor(frame) as string,
  };

  const getHeaderLabel = (): LabelValue[] => {
    const header: LabelValue[] = [
      {
        label: getFieldDisplayName(xField, frame),
        value: fmt(xField, xField.values[rowIndex]),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        color: series.pointColor(frame) as string,
      },
    ];

    return header;
  };

  const getContentLabel = (): LabelValue[] => {
    const content: LabelValue[] = [];

    if (yValue) {
      content.push({
        label: yValue.name,
        value: fmt(yValue.field, yValue.val),
      });
    }

    if (extraFields) {
      extraFields.forEach((field) => {
        content.push({
          label: field.name,
          value: fmt(field, field.values[rowIndex]),
        });
      });
    }

    return content;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} />
      <VizTooltipContent contentLabelValue={getContentLabel()} />
      {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={false} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
    padding: theme.spacing(0.5),
  }),
});
