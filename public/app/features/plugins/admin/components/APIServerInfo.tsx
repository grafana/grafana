import React, { useMemo, useState } from 'react';

import { CodeEditor } from '@grafana/ui';

import { CatalogPlugin } from '../types';

interface Props {
  plugin: CatalogPlugin;
}

export const APIServerInfo = ({ plugin }: Props) => {
  const [sampleQuery, setSampleQuery] = useState('{}');
  const url = useMemo(() => {
    switch (plugin.id) {
      case 'grafana-testdata-datasource':
        return 'http://localhost:3000/apis/testdata.datasource.grafana.app/v0alpha1';
    }
    return undefined;
  }, [plugin]);

  if (!url) {
    return <div>This plugin is not yet exposed in the API server</div>;
  }

  // http://localhost:3000/apis/query.grafana.app/v0alpha1/expressions.jsonschema
  const schemaURL = 'http://localhost:3000/apis/query.grafana.app/v0alpha1/expressions.jsonschema';

  return (
    <div>
      <h4>API URL</h4>
      <a href={url}>{url}</a>
      <br />
      <br />
      <br />

      <h4>Expression Query tester (inline JSONSchema validation)</h4>
      <CodeEditor
        language="json"
        height={500}
        width={'100%'}
        value={sampleQuery}
        onChange={setSampleQuery}
        onBeforeEditorMount={(monaco) => {
          monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            enableSchemaRequest: true,
            schemas: [
              {
                uri: schemaURL,
                fileMatch: ['*'], // associate with our model
              },
            ],
          });
        }}
      />
    </div>
  );
};
