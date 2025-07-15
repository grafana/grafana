// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/QueryPreview.tsx
import { EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';

import { promqlGrammar } from '../../promql';
import { RawQuery } from '../shared/RawQuery';

interface QueryPreviewProps {
  query: string;
}

export function QueryPreview({ query }: QueryPreviewProps) {
  if (!query) {
    return null;
  }

  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery query={query} lang={{ grammar: promqlGrammar, name: 'promql' }} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
