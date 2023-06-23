import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, Field, formattedValueToString, getFieldDisplayName, GrafanaTheme2, LinkModel } from '@grafana/data';
import { LinkButton, useStyles2, VerticalGroup, VizTooltipOptions } from '@grafana/ui';
import { findField } from 'app/features/dimensions';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { ScatterSeriesConfig, SeriesMapping } from './models.gen';
import { ScatterSeries } from './types';

interface YValue {
  name: string;
  val: number;
  field: Field;
  color: string;
}

interface ExtraFacets {
  colorFacetFieldName: string;
  sizeFacetFieldName: string;
  colorFacetValue: number;
  sizeFacetValue: number;
}

export interface Props {
  allSeries: ScatterSeries[];
  data: DataFrame[]; // source data
  manualSeriesConfigs: ScatterSeriesConfig[] | undefined;
  rowIndex?: number; // the hover row
  seriesMapping: SeriesMapping;
  hoveredPointIndex: number; // the hovered point
  options: VizTooltipOptions;
}

export const TooltipView = ({
  allSeries,
  data,
  manualSeriesConfigs,
  seriesMapping,
  rowIndex,
  hoveredPointIndex,
  options,
}: Props) => {
  const style = useStyles2(getStyles);

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);

  let links: LinkModel[] | undefined = undefined;

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

  let extraFields: Field[] = frame.fields.filter((f) => f !== xField && f !== yField);

  let yValue: YValue | null = null;
  let extraFacets: ExtraFacets | null = null;
  if (seriesMapping === SeriesMapping.Manual && manualSeriesConfigs) {
    const colorFacetFieldName = manualSeriesConfigs[hoveredPointIndex].pointColor?.field ?? '';
    const sizeFacetFieldName = manualSeriesConfigs[hoveredPointIndex].pointSize?.field ?? '';

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

  yValue = {
    name: getFieldDisplayName(yField, frame),
    val: yField.values[rowIndex],
    field: yField,
    color: series.pointColor(frame) as string,
  };

  return (
    <>
      <table className={style.infoWrap}>
        <tr>
          <th colSpan={2} style={{ backgroundColor: yValue.color }}></th>
        </tr>
        <tbody>
          <tr>
            <th>{getFieldDisplayName(xField, frame)}</th>
            <td>{fmt(xField, xField.values[rowIndex])}</td>
          </tr>
          <tr>
            <th>{yValue.name}:</th>
            <td>{fmt(yValue.field, yValue.val)}</td>
          </tr>
          {extraFacets !== null && extraFacets.colorFacetFieldName && (
            <tr>
              <th>{extraFacets.colorFacetFieldName}:</th>
              <td>{extraFacets.colorFacetValue}</td>
            </tr>
          )}
          {extraFacets !== null && extraFacets.sizeFacetFieldName && (
            <tr>
              <th>{extraFacets.sizeFacetFieldName}:</th>
              <td>{extraFacets.sizeFacetValue}</td>
            </tr>
          )}
          {extraFields.map((field, i) => (
            <tr key={i}>
              <th>{getFieldDisplayName(field, frame)}:</th>
              <td>{fmt(field, field.values[rowIndex])}</td>
            </tr>
          ))}
          {links && links.length > 0 && (
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
