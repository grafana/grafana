import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, DataSourceRef, getDataSourceRef, ScopedVars } from '@grafana/data';
import { BackendDataSourceResponse, FetchResponse, getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { store } from 'app/store/store';
import { AppNotificationTimeout } from 'app/types';

import memoizedDebounce from '../memoizedDebounce';
import { CloudWatchJsonData, Dimensions, MetricRequest, MultiFilters } from '../types';

export abstract class CloudWatchRequest {
  templateSrv: TemplateSrv;
  ref: DataSourceRef;
  dsQueryEndpoint = '/api/ds/query';
  debouncedCustomAlert: (title: string, message: string) => void = memoizedDebounce(
    displayCustomError,
    AppNotificationTimeout.Error
  );

  constructor(public instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
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

  convertDimensionFormat(dimensions: Dimensions, scopedVars: ScopedVars): Dimensions {
    return Object.entries(dimensions).reduce((result, [key, value]) => {
      key = this.replaceVariableAndDisplayWarningIfMulti(key, scopedVars, true, 'dimension keys');

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
    const variableName = this.templateSrv.getVariableName(value);
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

  replaceVariableAndDisplayWarningIfMulti(
    target?: string,
    scopedVars?: ScopedVars,
    displayErrorIfIsMultiTemplateVariable?: boolean,
    fieldName?: string
  ) {
    if (displayErrorIfIsMultiTemplateVariable && !!target) {
      const variables = this.templateSrv.getVariables();
      const variable = variables.find(({ name }) => name === this.templateSrv.getVariableName(target));
      const isMultiVariable =
        variable?.type === 'custom' || variable?.type === 'query' || variable?.type === 'datasource';
      if (isMultiVariable && variable.multi) {
        this.debouncedCustomAlert(
          'CloudWatch templating error',
          `Multi template variables are not supported for ${fieldName || target}`
        );
      }
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
  store.dispatch(notifyApp(createErrorNotification(title, message)));
