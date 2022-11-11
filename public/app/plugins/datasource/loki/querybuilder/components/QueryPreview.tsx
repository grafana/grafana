import React from 'react';

import { EditorRow, EditorFieldGroup, EditorField } from '@grafana/experimental';

import { RawQuery } from '../../../prometheus/querybuilder/shared/RawQuery';
import { lokiGrammar } from '../../syntax';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Raw query">
          <RawQuery query={query} lang={{ grammar: lokiGrammar, name: 'lokiql' }} />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
}
