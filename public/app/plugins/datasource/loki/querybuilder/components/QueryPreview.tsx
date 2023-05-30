import React from 'react';

import { EditorRow, EditorFieldGroup } from '@grafana/experimental';

import { RawQuery } from './RawQuery';

export interface Props {
  query: string;
}

export function QueryPreview({ query }: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery query={query} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
