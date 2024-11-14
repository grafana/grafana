import { createContext } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

import { K8sNameLookup } from './K8sNameLookup';

// swagger does not have types
interface UntypedProps {
  [k: string]: any;
}

export type SchemaType = Record<string, any> | undefined;
export type ResourceInfo = {
  group: string;
  version: string;
  resource: string;
  namespaced: boolean;
};

// Use react contexts to stash settings
export const SchemaContext = createContext<SchemaType>(undefined);
export const NamespaceContext = createContext<string | undefined>(undefined);
export const ResourceContext = createContext<ResourceInfo | undefined>(undefined);

/* eslint-disable react/display-name */
export const WrappedPlugins = function () {
  return {
    wrapComponents: {
      parameterRow: (Original: React.ElementType) => (props: UntypedProps) => {
        // When the parameter name is in the path, lets make it a drop down
        const name = props.param.get('name');
        const where = props.param.get('in');
        if (name === 'name' && where === 'path') {
          const path = props.specPath.get(1).split('/');
          if (path.length > 4 && path[1] === 'apis') {
            const info: ResourceInfo = {
              group: path[2],
              version: path[3],
              resource: path[4],
              namespaced: path[4] === 'namespaces',
            };
            if (info.namespaced) {
              info.resource = path[6];
            }
            // console.log('NAME (in path)', path, info);
            return (
              <ResourceContext.Provider value={info}>
                <Original {...props} />
              </ResourceContext.Provider>
            );
          }
        }
        return <Original {...props} />;
      },

      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/components/parameters/parameters.jsx#L235
      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/plugins/oas3/components/request-body.jsx#L35
      RequestBody: (Original: React.ElementType) => (props: UntypedProps) => {
        let v: SchemaType = undefined;
        const content = props.requestBody.get('content');
        if (content) {
          let mime = content.get('application/json') ?? content.get('*/*');
          if (mime) {
            v = mime.get('schema').toJS();
          }
          console.log('RequestBody', v, mime, props);
        }
        // console.log('RequestBody PROPS', props);
        return (
          <SchemaContext.Provider value={v}>
            <Original {...props} />
          </SchemaContext.Provider>
        );
      },

      modelExample: (Original: React.ElementType) => (props: UntypedProps) => {
        if (props.isExecute && props.schema) {
          console.log('modelExample PROPS', props);
          return (
            <SchemaContext.Provider value={props.schema.toJS()}>
              <Original {...props} />
            </SchemaContext.Provider>
          );
        }
        return <Original {...props} />;
      },

      JsonSchemaForm: (Original: React.ElementType) => (props: UntypedProps) => {
        const { description, disabled, required, onChange, value } = props;
        if (!disabled && required) {
          switch (description) {
            case 'namespace': {
              return (
                <NamespaceContext.Consumer>
                  {(namespace) => {
                    if (!value && namespace) {
                      setTimeout(() => {
                        // Fake type in the value
                        onChange(namespace);
                      }, 100);
                    }
                    return <Original {...props} />;
                  }}
                </NamespaceContext.Consumer>
              );
            }
            case 'name': {
              return <K8sNameLookup onChange={onChange} value={value} Original={Original} props={props} />;
            }
          }
        }
        return <Original {...props} />;
      },

      // https://github.com/swagger-api/swagger-ui/blob/v5.17.14/src/core/plugins/oas3/components/request-body-editor.jsx
      TextArea: (Original: React.ElementType) => (props: UntypedProps) => {
        return (
          <SchemaContext.Consumer>
            {(schema) => {
              if (schema) {
                const val = props.value ?? props.defaultValue ?? '';
                //console.log('JSON TextArea', props, info);
                // Return a synthetic text area event
                const cb = (txt: string) => {
                  props.onChange({
                    target: {
                      value: txt,
                    },
                  });
                };
                console.log('CodeEditor', schema);

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
              return <Original {...props} />;
            }}
          </SchemaContext.Consumer>
        );
      },
    },
  };
};
