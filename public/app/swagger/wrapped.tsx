import { createContext } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

type RequestBodyInfo = {
  path?: string[];
  schema?: Record<string, any>;
};

/* eslint-disable react/display-name */
export const WrappedPlugins = function () {
  const RequestBodyContext = createContext<RequestBodyInfo>({});

  return {
    wrapComponents: {
      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/components/parameters/parameters.jsx#L235
      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/plugins/oas3/components/request-body.jsx#L35
      RequestBody: (Original: React.ElementType) => (props: any) => {
        const v: RequestBodyInfo = {};
        const content = props.requestBody.get('content');
        if (content) {
          let mime = content.get('application/json') ?? content.get('*/*');
          if (mime) {
            v.path = props.specPath.toArray();
            v.schema = mime.get('schema').toJS();
          }
          console.log("RequestBody", v, mime, props);
        }
        // console.log('RequestBody PROPS', props);
        return (
          <RequestBodyContext.Provider value={v}>
            <Original {...props} />
          </RequestBodyContext.Provider>
        );
      },

      modelExample: (Original: React.ElementType) => (props: any) => {
        if (props.isExecute && props.schema) {
          console.log('modelExample PROPS', props);
          return (
            <RequestBodyContext.Provider value={{
              path: props.specPath.toArray(),
              schema: props.schema.toJS(),
            }}>
              <Original {...props} />
            </RequestBodyContext.Provider>
          );
        }
        return <Original {...props} />;
      },

      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/plugins/oas3/components/request-body-editor.jsx
      TextArea: (Original: React.ElementType) => (props: any) => {
        return (
          <RequestBodyContext.Consumer>
            {({schema}) => {
              console.log()
              if (schema ) {
                  const val = props.value ?? props.defaultValue ?? '';
                  //console.log('JSON TextArea', props, info);
                  const cb = (txt: string) => {
                    props.onChange({
                      target: {
                        value: txt,
                      },
                    });
                  };

                  return (
                    <CodeEditor
                      value={val}
                      height={300}
                      language="application/json"
                      showMiniMap={val.length > 500}
                      onBlur={cb}
                      onSave={cb}
                      onBeforeEditorMount={(monaco: Monaco) => {
                        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                          validate: true,
                          schemas: [
                            {
                              uri: schema['$$ref'] ?? '#internal',
                              fileMatch: ['*'], // everything
                              schema: schema,
                            },
                          ],
                        });
                      }}
                    />
                  );
              }
              console.log('TEXT AREA but no mimetype', props);
              return <Original {...props} />;
            }}
          </RequestBodyContext.Consumer>
        );
      },
    },
  };
};
