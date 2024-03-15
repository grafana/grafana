import React from 'react';

import { RawQuery } from '@grafana/experimental';
import { promqlGrammar } from '@grafana/prometheus';

interface Props {
  query: string;
}

const PrometheusQueryPreview = ({ query }: Props) => {
  return <RawQuery query={query} language={{ grammar: promqlGrammar, name: 'promql' }} />;
};

export default PrometheusQueryPreview;
