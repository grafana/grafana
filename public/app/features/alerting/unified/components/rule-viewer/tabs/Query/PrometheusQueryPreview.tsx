import { RawQuery } from '@grafana/plugin-ui';
import { promqlGrammar } from '@grafana/prometheus';

interface Props {
  query: string;
}

const PrometheusQueryPreview = ({ query }: Props) => {
  return (
    <pre>
      <RawQuery query={query} language={{ grammar: promqlGrammar, name: 'promql' }} />
    </pre>
  );
};

export default PrometheusQueryPreview;
