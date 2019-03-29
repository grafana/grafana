// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { StreamingDatasource } from './datasource';
import { StreamingQuery } from './types';

type Props = QueryEditorProps<StreamingDatasource, StreamingQuery>;

export class StreamingQueryEditor extends PureComponent<Props> {
  // TODO!!! nout used
  getCollapsedText() {
    return 'Streming!';
  }

  render() {
    return (
      <div>
        <div className="gf-form">TODO... show options</div>
      </div>
    );
  }
}

export default StreamingQueryEditor;
