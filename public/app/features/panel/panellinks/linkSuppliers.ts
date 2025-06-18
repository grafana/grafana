import {
  DataLink,
  DisplayValue,
  FieldDisplay,
  formattedValueToString,
  getFieldDisplayValuesProxy,
  getTimeField,
  InterpolateFunction,
  Labels,
  LinkModelSupplier,
  ScopedVar,
  ScopedVars,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { dashboardSceneGraph } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';

import { getLinkSrv } from './link_srv';

interface SeriesVars {
  name?: string;
  refId?: string;
}

interface FieldVars {
  name: string;
  labels?: Labels;
}

interface ValueVars {
  raw: any;
  numeric: number;
  text: string;
  time?: number;
  calc?: string;
}

interface DataViewVars {
  name?: string;
  refId?: string;
  fields?: Record<string, DisplayValue>;
}

interface DataLinkScopedVars extends ScopedVars {
  __series: ScopedVar<SeriesVars>;
  __field: ScopedVar<FieldVars>;
  __value: ScopedVar<ValueVars>;
  __data: ScopedVar<DataViewVars>;
}

/**
 * Link suppliers creates link models based on a link origin
 */
export const getFieldLinksSupplier = (value: FieldDisplay): LinkModelSupplier<FieldDisplay> | undefined => {
  const links = value.field.links;
  if (!links || links.length === 0) {
    return undefined;
  }

  return {
    getLinks: (replaceVariables: InterpolateFunction) => {
      const scopedVars: Partial<DataLinkScopedVars> = {};

      if (value.view) {
        const { dataFrame } = value.view;

        scopedVars['__series'] = {
          value: {
            name: dataFrame.name,
            refId: dataFrame.refId,
          },
          text: t('panel.get-field-links-supplier.text.series', 'Series'),
        };

        const field = value.colIndex !== undefined ? dataFrame.fields[value.colIndex] : undefined;

        if (field) {
          scopedVars['__field'] = {
            value: {
              name: field.name,
              labels: field.labels,
            },
            text: t('panel.get-field-links-supplier.text.field', 'Field'),
          };

          if (value.rowIndex !== undefined && value.rowIndex >= 0) {
            const { timeField } = getTimeField(dataFrame);
            scopedVars['__value'] = {
              value: {
                raw: field.values[value.rowIndex],
                numeric: value.display.numeric,
                text: formattedValueToString(value.display),
                time: timeField ? timeField.values[value.rowIndex] : undefined,
              },
              text: t('panel.get-field-links-supplier.text.value', 'Value'),
            };
          }

          // Expose other values on the row
          if (value.view) {
            scopedVars['__data'] = {
              value: {
                name: dataFrame.name,
                refId: dataFrame.refId,
                fields: getFieldDisplayValuesProxy({
                  frame: dataFrame,
                  rowIndex: value.rowIndex!,
                }),
              },
              text: t('panel.get-field-links-supplier.text.data', 'Data'),
            };
          }
        } else {
          // calculation
          scopedVars['__value'] = {
            value: {
              raw: value.display.numeric,
              numeric: value.display.numeric,
              text: formattedValueToString(value.display),
              calc: value.name,
            },
            text: t('panel.get-field-links-supplier.text.value', 'Value'),
          };
        }
      } else {
        console.log('VALUE', value);
      }

      const replace: InterpolateFunction = (value: string, vars: ScopedVars | undefined, fmt?: string | Function) => {
        const finalVars: ScopedVars = {
          ...scopedVars,
          ...vars,
        };
        return replaceVariables(value, finalVars, fmt);
      };

      return links.map((link: DataLink) => {
        return getLinkSrv().getDataLinkUIModel(link, replace, value);
      });
    },
  };
};

export const getPanelLinksSupplier = (
  panel: PanelModel,
  replaceVariables?: InterpolateFunction
): LinkModelSupplier<PanelModel> | undefined => {
  const links = panel.links;

  if (!links || links.length === 0) {
    return undefined;
  }

  return {
    getLinks: () => {
      return links.map((link) => {
        return getLinkSrv().getDataLinkUIModel(link, replaceVariables || panel.replaceVariables, panel);
      });
    },
  };
};

export const getScenePanelLinksSupplier = (
  panel: VizPanel,
  replaceVariables: InterpolateFunction
): LinkModelSupplier<VizPanel> | undefined => {
  const links = dashboardSceneGraph.getPanelLinks(panel)?.state.rawLinks;

  if (!links || links.length === 0) {
    return undefined;
  }

  return {
    getLinks: () => {
      return links.map((link) => {
        return getLinkSrv().getDataLinkUIModel(link, replaceVariables, panel);
      });
    },
  };
};
