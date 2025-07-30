// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilder.tsx
import { memo } from 'react';

import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery } from '../types';

import { BaseQueryBuilder } from './shared/BaseQueryBuilder';

interface PromQueryBuilderProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export const PromQueryBuilder = memo<PromQueryBuilderProps>((props) => {
  return <BaseQueryBuilder {...props} />;
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
