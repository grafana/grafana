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
import { findNextStateIndex, fmtDuration } from 'app/core/components/TimelineChart/utils';

interface StateTimelineTooltipProps {
  data: DataFrame[];
  alignedData: DataFrame;
  seriesIdx: number;
  datapointIdx: number;
  timeZone: TimeZone;
  onAnnotationAdd?: () => void;
}

export const StateTimelineTooltip = ({
  data,
  alignedData,
  seriesIdx,
  datapointIdx,
  timeZone,
  onAnnotationAdd,
}: StateTimelineTooltipProps) => {
  const theme = useTheme2();

  if (!data || datapointIdx == null) {
    return null;
  }

  const field = alignedData.fields[seriesIdx!];

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
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  const dataFrameFieldIndex = field.state?.origin;
  const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
  const value = field.values[datapointIdx!];
  const display = fieldFmt(value);
  const fieldDisplayName = dataFrameFieldIndex
    ? getFieldDisplayName(
        data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
        data[dataFrameFieldIndex.frameIndex],
        data
      )
    : null;

  const nextStateIdx = findNextStateIndex(field, datapointIdx!);
  let nextStateTs;
  if (nextStateIdx) {
    nextStateTs = xField.values[nextStateIdx!];
  }

  const stateTs = xField.values[datapointIdx!];

  let toFragment = null;
  let durationFragment = null;

  if (nextStateTs) {
    const duration = nextStateTs && fmtDuration(nextStateTs - stateTs);
    durationFragment = (
      <>
        <br />
        <strong>Duration:</strong> {duration}
      </>
    );
    toFragment = (
      <>
        {' to'} <strong>{xFieldFmt(xField.values[nextStateIdx!]).text}</strong>
      </>
    );
  }

  return (
    <div>
      <div style={{ fontSize: theme.typography.bodySmall.fontSize }}>
        {fieldDisplayName}
        <br />
        <SeriesTableRow label={display.text} color={display.color || FALLBACK_COLOR} isActive />
        From <strong>{xFieldFmt(xField.values[datapointIdx!]).text}</strong>
        {toFragment}
        {durationFragment}
      </div>
      <div
        style={{
          margin: theme.spacing(1, -1, -1, -1),
          borderTop: `1px solid ${theme.colors.border.weak}`,
        }}
      >
        {onAnnotationAdd && <MenuItem label={'Add annotation'} icon={'comment-alt'} onClick={onAnnotationAdd} />}
        {links.length > 0 &&
          links.map((link, i) => (
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
    </div>
  );
};

StateTimelineTooltip.displayName = 'StateTimelineTooltip';
