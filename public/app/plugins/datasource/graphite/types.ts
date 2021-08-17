import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { TemplateSrv } from '../../../features/templating/template_srv';

export interface GraphiteQuery extends DataQuery {
  target?: string;
}

export interface GraphiteOptions extends DataSourceJsonData {
  graphiteVersion: string;
  graphiteType: GraphiteType;
  rollupIndicatorEnabled?: boolean;
  importConfiguration: GraphiteQueryImportConfiguration;
}

export enum GraphiteType {
  Default = 'default',
  Metrictank = 'metrictank',
}

export interface MetricTankRequestMeta {
  [key: string]: any;
}

export interface MetricTankSeriesMeta {
  'schema-name': string;
  'schema-retentions': string; //"1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2",
  'archive-read': number;
  'archive-interval': number;
  'aggnum-norm': number;
  'consolidator-normfetch': string; //"MaximumConsolidator",
  'aggnum-rc': number;
  'consolidator-rc': string; //"MaximumConsolidator",
  count: number;
}

export interface MetricTankMeta {
  request: MetricTankRequestMeta;
  info: MetricTankSeriesMeta[];
}

export type GraphiteQueryImportConfiguration = {
  loki: GraphiteToLokiQueryImportConfiguration;
};

export type GraphiteToLokiQueryImportConfiguration = {
  mappings: GraphiteLokiMapping[];
};

export type GraphiteLokiMapping = {
  matchers: GraphiteMetricLokiMatcher[];
};

export type GraphiteMetricLokiMatcher = {
  value: string;
  labelName?: string;
};

export type GraphiteSegment = {
  value: string;
  type?: 'tag' | 'metric' | 'series-ref';
  expandable?: boolean;
  fake?: boolean;
};

export type GraphiteTagOperator = '=' | '!=' | '=~' | '!=~';

export type GraphiteTag = {
  key: string;
  operator: GraphiteTagOperator;
  value: string;
};

export type GraphiteActionDispatcher = (action: any) => Promise<void>;

export type GraphiteQueryEditorAngularDependencies = {
  panelCtrl: any;
  target: any;
  datasource: GraphiteDatasource;
  uiSegmentSrv: any;
  templateSrv: TemplateSrv;
};

export type AngularDropdownOptions = {
  text: string;
  value: string;
};
