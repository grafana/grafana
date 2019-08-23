import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv, { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { VariableSuggestion, ScopedVars, VariableOrigin, DataLinkBuiltInVars, FieldDisplay } from '@grafana/ui';
import { DataLink, LinkModelSupplier, KeyValue, deprecationWarning } from '@grafana/data';

export type FieldDisplayLinkFunction = (display: FieldDisplay) => LinkModel[] | undefined;

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...templateSrv.variables.map(variable => ({
    value: variable.name as string,
    origin: VariableOrigin.Template,
  })),
  {
    value: `${DataLinkBuiltInVars.includeVars}`,
    documentation: 'Adds current variables',
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.keepTime}`,
    documentation: 'Adds current time range',
    origin: VariableOrigin.BuiltIn,
  },
];

export const getDataLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...getPanelLinksVariableSuggestions(),
  {
    value: `${DataLinkBuiltInVars.seriesName}`,
    documentation: 'Adds series name',
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.valueTime}`,
    documentation: 'Time value of the clicked datapoint (in ms epoch)',
    origin: VariableOrigin.BuiltIn,
  },
];

type LinkTarget = '_blank' | '_self';

export interface LinkModel {
  href: string;
  title: string;
  target: LinkTarget;
}

export interface LinkService {
  getDataLinkUIModel: (link: DataLink, scopedVars: ScopedVars) => LinkModel;
  getLinkSupplier: (field: FieldDisplay) => LinkModelSupplier | undefined;
}

export class LinkSrv implements LinkService {
  /** @ngInject */
  constructor(private templateSrv: TemplateSrv, private timeSrv: TimeSrv) {}

  getLinkUrl(link: any) {
    const url = this.templateSrv.replace(link.url || '');
    const params: { [key: string]: any } = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    return appendQueryToUrl(url, toUrlParams(params));
  }

  getAnchorInfo(link: any) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = this.templateSrv.replace(link.title || '');
    return info;
  }

  getDataLinkUIModel = (link: DataLink, scopedVars: ScopedVars) => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    const info: LinkModel = {
      href: link.url,
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
    };

    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = toUrlParams(params);
    info.href = this.templateSrv.replace(link.url, {
      ...scopedVars,
      [DataLinkBuiltInVars.keepTime]: {
        text: timeRangeUrl,
        value: timeRangeUrl,
      },
      [DataLinkBuiltInVars.includeVars]: {
        text: variablesQuery,
        value: variablesQuery,
      },
    });

    return info;
  };

  getLinkSupplier = (value: FieldDisplay): LinkModelSupplier | undefined => {
    const links = value.field.links;
    if (!links || !links.length) {
      return undefined;
    }
    return {
      getLinks: (scopedVarsIgnoredForNow?: any) => {
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
          return this.getDataLinkUIModel(link, scopedVars);
        });
      },
    };
  };

  /**
   * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
   *
   * @deprecated Drilldown links should be generated using getDataLinkUIModel method
   */
  getPanelLinkAnchorInfo(link: DataLink, scopedVars: ScopedVars) {
    deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
    return this.getDataLinkUIModel(link, scopedVars);
  }
}

let singleton: LinkService;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  return singleton;
}

coreModule.service('linkSrv', LinkSrv);
