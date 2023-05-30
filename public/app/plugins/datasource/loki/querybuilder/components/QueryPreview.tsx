import React from 'react';

import { EditorRow, EditorFieldGroup } from '@grafana/experimental';

import { LokiDatasource } from '../../datasource';

import { RawQuery } from './RawQuery';

export interface Props {
  query: string;
  datasource: LokiDatasource;
}

export function QueryPreview(props: Props) {
  return (
    <EditorRow>
      <EditorFieldGroup>
        <RawQuery {...props} />
      </EditorFieldGroup>
    </EditorRow>
  );
}
