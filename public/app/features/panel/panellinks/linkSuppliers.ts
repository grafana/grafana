import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { FieldDisplay, DataLinkBuiltInVars } from '@grafana/ui';
import { LinkModelSupplier, getTimeField, ScopedVars } from '@grafana/data';
import { getLinkSrv } from './link_srv';

/**
 * Link suppliers creates link models based on a link origin
 */

export const getFieldLinksSupplier = (value: FieldDisplay): LinkModelSupplier<FieldDisplay> | undefined => {
  const links = value.field.links;
  if (!links || links.length === 0) {
    return undefined;
  }
  return {
    getLinks: (_scopedVars?: any) => {
      const scopedVars: ScopedVars = {};
      // TODO, add values to scopedVars and/or pass objects to event listeners
      if (value.view) {
        scopedVars[DataLinkBuiltInVars.seriesName] = {
          text: 'Series',
          value: value.view.dataFrame.name,
        };
        const field = value.column ? value.view.dataFrame.fields[value.column] : undefined;
        if (field) {
          console.log('Full Field Info:', field);
        }
        if (value.row) {
          const row = value.view.get(value.row);
          console.log('ROW:', row);
          const dataFrame = value.view.dataFrame;

          const { timeField } = getTimeField(dataFrame);
          if (timeField) {
            scopedVars[DataLinkBuiltInVars.valueTime] = {
              text: 'Value time',
              value: timeField.values.get(value.row),
            };
          }
        }
      } else {
        console.log('VALUE', value);
      }

      return links.map(link => {
        return getLinkSrv().getDataLinkUIModel(link, scopedVars, value);
      });
    },
  };
};

export const getPanelLinksSupplier = (value: PanelModel): LinkModelSupplier<PanelModel> => {
  const links = value.links;

  if (!links || links.length === 0) {
    return undefined;
  }

  return {
    getLinks: () => {
      return links.map(link => {
        return getLinkSrv().getDataLinkUIModel(link, value.scopedVars, value);
      });
    },
  };
};
