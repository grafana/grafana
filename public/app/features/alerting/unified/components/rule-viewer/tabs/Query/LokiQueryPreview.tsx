import { lokiGrammar } from '@grafana/lezer-logql';
import { RawQuery } from '@grafana/plugin-ui';

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
