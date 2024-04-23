import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, DataSourceRef, getDataSourceRef, ScopedVars, AppEvents } from '@grafana/data';
import { BackendDataSourceResponse, FetchResponse, getBackendSrv, TemplateSrv, getAppEvents } from '@grafana/runtime';

import memoizedDebounce from '../memoizedDebounce';
import { CloudWatchJsonData, Dimensions, MetricRequest, MultiFilters } from '../types';
import { getVariableName } from '../utils/templateVariableUtils';

export abstract class CloudWatchRequest {
  templateSrv: TemplateSrv;
  ref: DataSourceRef;
  dsQueryEndpoint = '/api/ds/query';
  debouncedCustomAlert: (title: string, message: string) => void = memoizedDebounce(displayCustomError);

  constructor(
    public instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    templateSrv: TemplateSrv
  ) {
    this.templateSrv = templateSrv;
    this.ref = getDataSourceRef(instanceSettings);
  }

  awsRequest(
    url: string,
    data: MetricRequest,
    headers: Record<string, string> = {}
  ): Observable<FetchResponse<BackendDataSourceResponse>> {
    const options = {
      method: 'POST',
      url,
      data,
      headers,
    };

    return getBackendSrv().fetch<BackendDataSourceResponse>(options);
  }

  convertDimensionFormat(
    dimensions: Dimensions,
    scopedVars: ScopedVars,
    displayErrorIfIsMultiTemplateVariable = true
  ): Dimensions {
    return Object.entries(dimensions).reduce((result, [key, value]) => {
      key = this.replaceVariableAndDisplayWarningIfMulti(
        key,
        scopedVars,
        displayErrorIfIsMultiTemplateVariable,
        'dimension keys'
      );

      if (Array.isArray(value)) {
        return { ...result, [key]: value };
      }

      if (!value) {
        return { ...result, [key]: null };
      }

      const newValues = this.expandVariableToArray(value, scopedVars);
      return { ...result, [key]: newValues };
    }, {});
  }

  // get the value for a given template variable
  expandVariableToArray(value: string, scopedVars: ScopedVars): string[] {
    const variableName = getVariableName(value);
    const valueVar = this.templateSrv.getVariables().find(({ name }) => {
      return name === variableName;
    });

    if (variableName && valueVar) {
      const isMultiVariable =
        valueVar?.type === 'custom' || valueVar?.type === 'query' || valueVar?.type === 'datasource';
      if (isMultiVariable && valueVar.multi) {
        return this.templateSrv.replace(value, scopedVars, 'pipe').split('|');
      }
      return [this.templateSrv.replace(value, scopedVars)];
    }
    return [value];
  }

  convertMultiFilterFormat(multiFilters: MultiFilters, fieldName?: string) {
    return Object.entries(multiFilters).reduce((result, [key, values]) => {
      const interpolatedKey = this.replaceVariableAndDisplayWarningIfMulti(key, {}, true, fieldName);
      if (!values) {
        return { ...result, [interpolatedKey]: null };
      }
      const initialVal: string[] = [];
      const newValues = values.reduce((result, value) => {
        const vals = this.expandVariableToArray(value, {});
        return [...result, ...vals];
      }, initialVal);
      return { ...result, [interpolatedKey]: newValues };
    }, {});
  }

  isMultiVariable(target?: string) {
    if (target) {
      const variables = this.templateSrv.getVariables();
      const variable = variables.find(({ name }) => name === getVariableName(target));
      const type = variable?.type;
      return (type === 'custom' || type === 'query' || type === 'datasource') && variable?.multi;
    }

    return false;
  }

  isVariableWithMultipleOptionsSelected(target?: string, scopedVars?: ScopedVars) {
    if (!target || !this.isMultiVariable(target)) {
      return false;
    }
    return this.expandVariableToArray(target, scopedVars || {}).length > 1;
  }

  replaceVariableAndDisplayWarningIfMulti(
    target?: string,
    scopedVars?: ScopedVars,
    displayErrorIfIsMultiTemplateVariable?: boolean,
    fieldName?: string
  ) {
    if (displayErrorIfIsMultiTemplateVariable && this.isVariableWithMultipleOptionsSelected(target)) {
      this.debouncedCustomAlert(
        'CloudWatch templating error',
        `Multi template variables are not supported for ${fieldName || target}`
      );
    }

    return this.templateSrv.replace(target, scopedVars);
  }

  getActualRegion(region?: string) {
    if (region === 'default' || region === undefined || region === '') {
      return this.instanceSettings.jsonData.defaultRegion ?? '';
    }
    return region;
  }

  getVariables() {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }
}

const displayCustomError = (title: string, message: string) =>
  getAppEvents().publish({
    type: AppEvents.alertError.name,
    payload: [title, message],
  });
