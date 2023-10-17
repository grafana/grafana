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
import { LabelValue } from '@grafana/ui/src/components/VizTooltip/types';

interface StatusHistoryTooltipProps {
  data: DataFrame[];
  dataIdxs: Array<number | null>;
  alignedData: DataFrame;
  seriesIdx: number | null | undefined;
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
  timeZone,
  isPinned,
}: StatusHistoryTooltipProps) => {
  const styles = useStyles2(getStyles);

  // @todo: check other dataIdx, it can be undefined or null in array
  const datapointIdx = dataIdxs.find((idx) => idx !== undefined);
  const seriesIndex = dataIdxs.findIndex((idx) => idx != null);

  if (!data || datapointIdx == null) {
    return null;
  }

  const xField = alignedData.fields[0];
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

  const fieldFmt = field.display || getDisplayProcessor();
  const value = field.values[datapointIdx!];
  const display = fieldFmt(value);

  const getHeaderLabel = (): LabelValue => {
    return {
      label: getFieldDisplayName(field),
      value: fmt(field, field.values[datapointIdx]),
      color: display.color || (FALLBACK_COLOR as string),
    };
  };

  const getContentLabelValue = (): LabelValue[] => {
    return [
      {
        label: 'Time',
        value: fmt(xField, xField.values[datapointIdx]),
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
