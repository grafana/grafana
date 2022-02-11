import React from 'react';
import { DataFrame, Field, FieldType, formattedValueToString, getValueFormat, LinkModel } from '@grafana/data';

import { HeatmapHoverEvent } from './utils';
import { HeatmapData } from './fields';
import { LinkButton, VerticalGroup } from '@grafana/ui';

type Props = {
  data: HeatmapData;
  hover: HeatmapHoverEvent;
  showHistogram?: boolean;
};

export const HeatmapHoverView = ({ data, hover, showHistogram }: Props) => {
  const xField = data.heatmap?.fields[0];
  const yField = data.heatmap?.fields[1];
  const countField = data.heatmap?.fields[2];

  let xDisplay = xField?.display ?? getDisplay;
  const yDisplay = yField?.display ?? getDisplay;

  if (xField?.type === FieldType.time) {
    // TODO: format display use getValueFormat('ms') if is time field type
    // xDisplay =
  }

  const xBucketMin = xField?.values.get(hover.xIndex);
  const yBucketMin = yField?.values.get(hover.xIndex);

  const xBucketMax = xBucketMin + data.xBucketSize;
  const yBucketMax = yBucketMin + data.yBucketSize;

  const count = countField?.values.get(hover.xIndex);

  const x = formattedValueToString(xDisplay(xBucketMin));

  const visibleFields = data.heatmap?.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const field of visibleFields ?? []) {
    const v = field.values.get(hover.xIndex);
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };

    // TODO: Currently always undefined? (getLinks)
    if (field.getLinks) {
      field.getLinks({ calculatedValue: disp, valueRowIndex: hover.xIndex }).forEach((link) => {
        const key = `${link.title}/${link.href}`;
        if (!linkLookup.has(key)) {
          links.push(link);
          linkLookup.add(key);
        }
      });
    }
  }

  return (
    <>
      <div>
        X Bucket: {xBucketMin} - {xBucketMax}
      </div>
      <div>
        Y Bucket: {yBucketMin} - {yBucketMax}
      </div>
      <div>Count: {count}</div>
      {showHistogram && <div>TODO: Histogram placeholder</div>}
      {links.length > 0 && (
        <VerticalGroup>
          {links.map((link, i) => (
            <LinkButton
              key={i}
              icon={'external-link-alt'}
              target={link.target}
              href={link.href}
              onClick={link.onClick}
              fill="text"
              style={{ width: '100%' }}
            >
              {link.title}
            </LinkButton>
          ))}
        </VerticalGroup>
      )}
    </>
  );
};

const getDisplay = (value: any) => ({ text: `${value}`, numeric: +value });
