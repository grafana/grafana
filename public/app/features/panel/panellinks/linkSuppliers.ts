import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { FieldDisplay, ScopedVars, isFieldDisplay } from '@grafana/ui';
import { LinkModelSupplier } from '@grafana/data';
import { getLinkSrv } from './link_srv';

/**
 * Link suppliers creates link models based on a link origin
 */

const getFieldLinksSupplier = (value: FieldDisplay): LinkModelSupplier<FieldDisplay> => {
  const links = value.field.links;
  if (!links || !links.length) {
    return undefined;
  }
  return {
    getLinks: (_scopedVars?: any) => {
      const scopedVars: ScopedVars = {};
      // TODO, add values to scopedVars and/or pass objects to event listeners
      if (value.view) {
        const field = value.column ? value.view.dataFrame.fields[value.column] : undefined;
        if (field) {
          console.log('Full Field Info:', field);
        }
        if (value.row) {
          const row = value.view.get(value.row);
          console.log('ROW:', row);
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

  if (!links || !links.length) {
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

export function getLinkSupplier<T extends object>(value: T): LinkModelSupplier<T> | undefined {
  if (isFieldDisplay(value)) {
    // TODO: any ideas how to make this ts problem gone?
    // @ts-ignore
    return getFieldLinksSupplier(value);
  }

  // if(isPanelModel(value)) {
  //   return getPanelLinksSupplier(value);
  // }

  console.warn('No link supplier available for', value);
  return undefined;
}
