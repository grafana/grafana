import React from 'react';

import {
  DataFrame,
  FALLBACK_COLOR,
  Field,
  getDisplayProcessor,
  getFieldDisplayName,
  TimeZone,
  LinkModel,
} from '@grafana/data';
import { MenuItem, SeriesTableRow, useTheme2 } from '@grafana/ui';

interface StatusHistoryTooltipProps {
  data: DataFrame[];
  alignedData: DataFrame;
  seriesIdx: number;
  datapointIdx: number;
  timeZone: TimeZone;
}

export const StatusHistoryTooltip = ({
  data,
  alignedData,
  seriesIdx,
  datapointIdx,
  timeZone,
}: StatusHistoryTooltipProps) => {
  const theme = useTheme2();

  if (!data || datapointIdx == null) {
    return null;
  }

  const field = alignedData.fields[seriesIdx!];

  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  if (field.getLinks) {
    const v = field.values.get(datapointIdx);
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
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  const dataFrameFieldIndex = field.state?.origin;
  const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
  const value = field.values.get(datapointIdx!);
  const display = fieldFmt(value);
  const fieldDisplayName = dataFrameFieldIndex
    ? getFieldDisplayName(
        data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
        data[dataFrameFieldIndex.frameIndex],
        data
      )
    : null;

  return (
    <div>
      <div style={{ fontSize: theme.typography.bodySmall.fontSize }}>
        <strong>{xFieldFmt(xField.values.get(datapointIdx)).text}</strong>
        <br />
        <SeriesTableRow label={display.text} color={display.color || FALLBACK_COLOR} isActive />
        {fieldDisplayName}
      </div>
      {links.length > 0 && (
        <div
          style={{
            margin: theme.spacing(1, -1, -1, -1),
            borderTop: `1px solid ${theme.colors.border.weak}`,
          }}
        >
          {links.map((link, i) => (
            <MenuItem
              key={i}
              icon={'external-link-alt'}
              target={link.target}
              label={link.title}
              url={link.href}
              onClick={link.onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

StatusHistoryTooltip.displayName = 'StatusHistoryTooltip';
