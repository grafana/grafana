import React from 'react';
import { DataFrame, Field, FieldType, formattedValueToString, getValueFormat, LinkModel } from '@grafana/data';

import { HeatmapHoverEvent } from './utils';
import { HeatmapData } from './fields';
import { LinkButton, VerticalGroup } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

type Props = {
  data: HeatmapData;
  hover: HeatmapHoverEvent;
  showHistogram?: boolean;
};

export const HeatmapHoverView = ({ data, hover, showHistogram }: Props) => {
  const xField = data.heatmap?.fields[0];
  const yField = data.heatmap?.fields[1];
  const countField = data.heatmap?.fields[2];

  const xBucketMin = xField?.values.get(hover.index);
  const yBucketMin = yField?.values.get(hover.index);

  const xBucketMax = xBucketMin + data.xBucketSize;
  const yBucketMax = yBucketMin + data.yBucketSize;

  const tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
  const dashboard = getDashboardSrv().getCurrent();
  const minTime = dashboard?.formatDate(xBucketMin, tooltipTimeFormat);
  const maxTime = dashboard?.formatDate(xBucketMax, tooltipTimeFormat);

  const count = countField?.values.get(hover.index);

  const visibleFields = data.heatmap?.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const field of visibleFields ?? []) {
    const v = field.values.get(hover.index);
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };

    // TODO: Currently always undefined? (getLinks)
    if (field.getLinks) {
      field.getLinks({ calculatedValue: disp, valueRowIndex: hover.index }).forEach((link) => {
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
        X Bucket: {minTime} - {maxTime}
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
