import React from 'react';

import { EditorRow, EditorFieldGroup } from '@grafana/experimental';

import { RawQuery } from '../../../prometheus/querybuilder/shared/RawQuery';
import { lokiGrammar } from '../../syntax';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery query={query} lang={{ grammar: lokiGrammar, name: 'lokiql' }} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
