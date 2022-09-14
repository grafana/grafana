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

import { ScatterSeriesConfig, SeriesMapping } from './models.gen';
import { ScatterSeries } from './types';

export interface Props {
  allSeries: ScatterSeries[];
  data: DataFrame[]; // source data
  manualSeriesConfigs: ScatterSeriesConfig[] | undefined;
  rowIndex?: number; // the hover row
  seriesMapping: SeriesMapping;
  hoveredPointIndex: number; // the hovered point
  options: VizTooltipOptions;
  range: TimeRange;
}

export const TooltipView = ({
  allSeries,
  data,
  manualSeriesConfigs,
  seriesMapping,
  rowIndex,
  hoveredPointIndex,
  options,
  range,
}: Props) => {
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
  let extraFacets: string | any[] = [];
  if (options.mode === TooltipDisplayMode.Single) {
    if (seriesMapping === SeriesMapping.Manual && manualSeriesConfigs) {
      const colorFacetFieldName = manualSeriesConfigs[hoveredPointIndex].pointColor?.field;
      const sizeFacetFieldName = manualSeriesConfigs[hoveredPointIndex].pointSize?.field;

      const colorFacet = colorFacetFieldName ? frame.fields.find((f) => f.name === colorFacetFieldName) : undefined;
      const sizeFacet = sizeFacetFieldName ? frame.fields.find((f) => f.name === sizeFacetFieldName) : undefined;

      extraFacets = [
        {
          colorFacetFieldName,
          sizeFacetFieldName,
          colorFacetValue: colorFacet?.values.get(rowIndex),
          sizeFacetValue: sizeFacet?.values.get(rowIndex),
        },
      ];
    }

    yValues = [
      {
        name: getFieldDisplayName(yField, frame),
        val: yField.values.get(rowIndex),
        field: yField,
        color: series.pointColor(frame),
      },
    ];
  } else {
    if (seriesMapping === SeriesMapping.Manual && manualSeriesConfigs) {
      extraFacets = allSeries.map((series, i) => {
        const colorFacetFieldName = manualSeriesConfigs[i].pointColor?.field;
        const sizeFacetFieldName = manualSeriesConfigs[i].pointSize?.field;

        const frame = series.frame(data);

        const colorFacet = colorFacetFieldName ? frame.fields.find((f) => f.name === colorFacetFieldName) : undefined;
        const sizeFacet = sizeFacetFieldName ? frame.fields.find((f) => f.name === sizeFacetFieldName) : undefined;

        return {
          colorFacetFieldName,
          sizeFacetFieldName,
          colorFacetValue: colorFacet?.values.get(rowIndex),
          sizeFacetValue: sizeFacet?.values.get(rowIndex),
        };
      });
    }

    yValues = allSeries
      .map((series, i) => {
        const frame = series.frame(data);
        const seriesXField = series.x(frame);

        if (seriesXField.name !== xField.name) {
          return null;
        }

        const seriesYField: Field = series.y(frame);

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
        {xField.name}: {fmt(frame.fields[0], xField.values.get(rowIndex))}
      </div>
      <table className={style.infoWrap}>
        <tbody>
          {yValues.map((el, index) => {
            let color = null;
            if (typeof el!.color === 'string') {
              color = el!.color;
            }

            return (
              <>
                <tr key={`${index}/${rowIndex}`} className={index === activePointIndex ? style.highlight : ''}>
                  <th>{color && <SeriesIcon color={color} className={style.icon} />}</th>
                  <th>Y - {el!.name}:</th>
                  <td>{fmt(el!.field, el!.val)}</td>
                </tr>
                {extraFacets.length > 0 && (
                  <>
                    {extraFacets[index].colorFacetFieldName && (
                      <tr
                        key={`${index}/${rowIndex}/color`}
                        className={index === activePointIndex ? style.highlight : ''}
                      >
                        <th></th>
                        <th>Color - {extraFacets[index].colorFacetFieldName}:</th>
                        <td>{extraFacets[index].colorFacetValue}</td>
                      </tr>
                    )}
                    <tr key={`${index}/${rowIndex}/size`} className={index === activePointIndex ? style.highlight : ''}>
                      <th></th>
                      <th>Size - {extraFacets[index].sizeFacetFieldName}:</th>
                      <td>{extraFacets[index].sizeFacetValue}</td>
                    </tr>
                  </>
                )}
              </>
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
