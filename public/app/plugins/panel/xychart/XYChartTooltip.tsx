import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { YValue } from './types';
import { XYSeries } from './types2';
import { fmt } from './utils';

export interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number;
  isPinned: boolean;
  dismiss: () => void;
  data: DataFrame[]; // source data
  series: XYSeries[];
}

export const XYChartTooltip = ({ dataIdxs, seriesIdx, data, dismiss, series: xySeries, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  const series = xySeries[seriesIdx - 1];
  const rowIdx = dataIdxs[seriesIdx]!;
  const xField = series.x.field;
  const yField = series.y.field;

  const getHeaderLabel = (): LabelValue => {
    let label = series.name;

    let colorThing = series.color.fixed; // todo: dynamic via field.display(value).color

    return {
      label,
      value: null,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      color: alpha(colorThing as string, 0.5),
      colorIndicator: ColorIndicator.marker_md,
    };
  };

  const getContentLabel = (): LabelValue[] => {
    let colorThing = series.color.fixed;

    const yValue: YValue = {
      name: yField.state?.displayName!,
      val: yField.values[rowIdx],
      field: yField,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      color: alpha(colorThing as string, 0.5),
    };

    const content: LabelValue[] = [
      {
        label: xField.state?.displayName!,
        value: fmt(xField, xField.values[rowIdx]),
      },
      {
        label: yValue.name,
        value: fmt(yValue.field, yValue.val),
      },
    ];

    /*
    // add extra fields
    const extraFields: Field[] = frame.fields.filter((f) => f !== xField && f !== yField);
    if (extraFields) {
      extraFields.forEach((field) => {
        content.push({
          label: field.name,
          value: fmt(field, field.values[rowIdx]),
        });
      });
    }
    */

    return content;
  };

  const getLinks = (): Array<LinkModel<Field>> => {
    let links: Array<LinkModel<Field>> = [];
    if (yField.getLinks) {
      const v = yField.values[rowIdx];
      const disp = yField.display ? yField.display(v) : { text: `${v}`, numeric: +v };
      links = yField.getLinks({ calculatedValue: disp, valueRowIndex: rowIdx }).map((linkModel) => {
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
  }),
});
