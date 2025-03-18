import { EditorRow, EditorFieldGroup, RawQuery } from '@grafana/experimental';

import { lokiGrammar } from '../../syntax';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery query={query} language={{ grammar: lokiGrammar, name: 'lokiql' }} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
