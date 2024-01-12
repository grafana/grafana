import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, Field, getFieldDisplayName, GrafanaTheme2, LinkModel } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { Options } from './panelcfg.gen';
import { ScatterSeries, YValue } from './types';
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
  // @todo: remove -1 when uPlot v2 arrive
  // context: first value in dataIdxs always null and represent X series
  const hoveredPointIndex = seriesIdx! - 1;

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);

  const getHeaderLabel = (): LabelValue => {
    let label = series.name;
    if (options.seriesMapping === 'manual') {
      label = options.series?.[hoveredPointIndex]?.name ?? `Series ${hoveredPointIndex + 1}`;
    }

    let colorThing = series.pointColor(frame);

    if (Array.isArray(colorThing)) {
      colorThing = colorThing[rowIndex];
    }

    return {
      label,
      value: null,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      color: alpha(colorThing as string, 0.5),
      colorIndicator: ColorIndicator.marker_md,
    };
  };

  const getContentLabel = (): LabelValue[] => {
    let colorThing = series.pointColor(frame);

    if (Array.isArray(colorThing)) {
      colorThing = colorThing[rowIndex];
    }

    const yValue: YValue = {
      name: getFieldDisplayName(yField, frame),
      val: yField.values[rowIndex],
      field: yField,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      color: alpha(colorThing as string, 0.5),
    };

    const content: LabelValue[] = [
      {
        label: getFieldDisplayName(xField, frame),
        value: fmt(xField, xField.values[rowIndex]),
      },
      {
        label: yValue.name,
        value: fmt(yValue.field, yValue.val),
      },
    ];

    // add extra fields
    const extraFields: Field[] = frame.fields.filter((f) => f !== xField && f !== yField);
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

  const getLinks = (): Array<LinkModel<Field>> => {
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
    return links;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} isPinned={isPinned} />
      <VizTooltipContent contentLabelValue={getContentLabel()} isPinned={isPinned} />
      {isPinned && <VizTooltipFooter dataLinks={getLinks()} />}
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
