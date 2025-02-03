import { RawQuery } from '@grafana/plugin-ui';
import lokiGrammar from 'app/plugins/datasource/loki/syntax';

interface Props {
  query: string;
}

const LokiQueryPreview = ({ query }: Props) => {
  return (
    <pre>
      <RawQuery query={query} language={{ grammar: lokiGrammar, name: 'promql' }} />
    </pre>
  );
};

export default LokiQueryPreview;
