import React from 'react';

import { EditorFieldGroup, EditorRow } from '@grafana/experimental';

import promqlGrammar from '../../promql';
import { RawQuery } from '../shared/RawQuery';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery query={query} lang={{ grammar: promqlGrammar, name: 'promql' }} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
