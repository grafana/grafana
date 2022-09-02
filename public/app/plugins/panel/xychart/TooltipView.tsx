import { css } from '@emotion/css';
import React from 'react';

import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
  TimeRange,
} from '@grafana/data';
import { SortOrder } from '@grafana/schema';
import {
  LinkButton,
  SeriesIcon,
  TooltipDisplayMode,
  usePanelContext,
  useStyles2,
  VerticalGroup,
  VizTooltipOptions,
} from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';

import { ScatterSeries } from './types';

export interface Props {
  allSeries: ScatterSeries[];
  data: DataFrame[]; // source data
  rowIndex?: number; // the hover row
  hoveredPointIndex: number; // the hovered point
  options: VizTooltipOptions;
  range: TimeRange;
}

export const TooltipView = ({ allSeries, data, rowIndex, hoveredPointIndex, options, range }: Props) => {
  const style = useStyles2(getStyles);
  const { onSplitOpen } = usePanelContext();

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);
  const links: Array<LinkModel<Field>> = getFieldLinksForExplore({
    field: yField,
    splitOpenFn: onSplitOpen,
    rowIndex,
    range,
  });

  let yValues = [];
  if (options.mode === TooltipDisplayMode.Single) {
    yValues = [
      {
        name: getFieldDisplayName(yField, frame),
        val: yField.values.get(rowIndex),
        field: yField,
        color: series.pointColor(frame),
      },
    ];
  } else {
    yValues = allSeries
      .map((series, i) => {
        const frame = series.frame(data);
        const seriesXField = series.x(frame);

        if (seriesXField.name !== xField.name) {
          return null;
        }

        const seriesYField = series.y(frame);

        return {
          name: getFieldDisplayName(seriesYField, frame),
          val: seriesYField.values.get(rowIndex),
          field: seriesYField,
          color: allSeries[i].pointColor(frame),
        };
      })
      .filter((v) => v != null);
  }

  if (options.sort !== SortOrder.None) {
    const sortFn = arrayUtils.sortValues(options.sort);

    yValues.sort((a, b) => {
      return sortFn(a!.val, b!.val);
    });
  }

  let activePointIndex = -1;
  activePointIndex = yValues.findIndex((v) => v!.name === series.name);

  return (
    <>
      <div className={style.xVal} aria-label="x-val">
        {fmt(frame.fields[0], xField.values.get(rowIndex))}
      </div>
      <table className={style.infoWrap}>
        <tbody>
          {yValues.map((el, index) => {
            let color = null;
            if (typeof el!.color === 'string') {
              color = el!.color;
            }

            return (
              <tr key={`${index}/${rowIndex}`} className={index === activePointIndex ? style.highlight : ''}>
                <th>
                  {color && <SeriesIcon color={color} className={style.icon} />}
                  {el!.name}:
                </th>
                <td>{fmt(el!.field, el!.val)}</td>
              </tr>
            );
          })}
          {links.length > 0 && (
            <tr>
              <td colSpan={2}>
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
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
};

function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }
  return `${val}`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  infoWrap: css`
    padding: 8px;
    width: 100%;
    th {
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.25, 2)};
    }
  `,
  highlight: css`
    background: ${theme.colors.action.hover};
  `,
  xVal: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  icon: css`
    margin-right: ${theme.spacing(1)};
    vertical-align: middle;
  `,
});
