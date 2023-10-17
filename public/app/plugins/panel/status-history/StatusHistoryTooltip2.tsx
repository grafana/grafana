import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  FALLBACK_COLOR,
  Field,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  TimeZone,
  LinkModel,
} from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { Options } from './panelcfg.gen';

interface StatusHistoryTooltipProps {
  data: DataFrame[];
  dataIdxs: Array<number | null>;
  alignedData: DataFrame;
  seriesIdx: number | null | undefined;
  // datapointIdx: number;
  timeZone: TimeZone;
  isPinned: boolean;
}

function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }

  return `${val}`;
}

export const StatusHistoryTooltip2 = ({
  data,
  dataIdxs,
  alignedData,
  seriesIdx,
  // datapointIdx,
  timeZone,
  isPinned,
}: StatusHistoryTooltipProps) => {
  const styles = useStyles2(getStyles);

  // check other dataIdx, it can be undefined or null in array
  const datapointIdx = dataIdxs.find((idx) => idx !== undefined);
  // @todo: remove -1 when uPlot v2 arrive
  // context: first value in dataIdxs always null and represent X serie
  const seriesIndex = dataIdxs.findIndex((idx) => idx != null);

  if (!data || datapointIdx == null) {
    return null;
  }

  const field = alignedData.fields[seriesIndex!];

  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  if (field.getLinks) {
    const v = field.values[datapointIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
    field.getLinks({ calculatedValue: disp, valueRowIndex: datapointIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  const xField = alignedData.fields[0];
  // const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
  // const xFieldFmt = xField.display;
  // const xFieldFmt = xField.display || getDisplayProcessor();

  // const dataFrameFieldIndex = field.state?.origin;
  // const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
  const fieldFmt = field.display || getDisplayProcessor();
  // const fieldFmt = field.display;
  const value = field.values[datapointIdx!];
  const display = fieldFmt(value);

  // const fieldDisplayName = dataFrameFieldIndex
  //   ? getFieldDisplayName(
  //       data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
  //       data[dataFrameFieldIndex.frameIndex],
  //       data
  //     )
  //   : '';

  const getHeaderLabel = (): LabelValue => {
    return {
      // label: fieldDisplayName,
      label: getFieldDisplayName(field),
      // value: display.text,
      value: fmt(field, field.values[datapointIdx]),
      color: display.color || (FALLBACK_COLOR as string),
    };
  };

  const getContentLabelValue = (): LabelValue[] => {
    return [
      {
        // label: getFieldDisplayName(xField, frame),
        // label: xField.name,
        label: 'Time',
        value: fmt(xField, xField.values[datapointIdx]),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        // color: series.pointColor(frame) as string,
        // color: display.color || (FALLBACK_COLOR as string),
      },
    ];
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} />
      <VizTooltipContent contentLabelValue={getContentLabelValue()} />
      {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={false} />}
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
