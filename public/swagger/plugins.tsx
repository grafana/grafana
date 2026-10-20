import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef } from 'react';

import { K8sNameLookup } from './K8sNameLookup';
import { NamespaceContext, ResourceContext, type ResourceInfo } from './contexts';

const SchemaEditor = lazy(() => import('./SchemaEditor'));

// swagger does not have types
interface UntypedProps {
  [k: string]: any;
}

type SchemaType = Record<string, any> | undefined;
// Use react contexts to stash settings
const SchemaContext = createContext<SchemaType>(undefined);

function NamespaceInput({ Original, ...props }: UntypedProps & { Original: React.ElementType }) {
  const namespace = useContext(NamespaceContext);
  const initialized = useRef(false);
  const { disabled, value, onChange } = props;

  useEffect(() => {
    if (!disabled && namespace && !initialized.current) {
      initialized.current = true;
      // Swagger may have populated the schema's generic default before settings arrived.
      if (!value || value === 'default') {
        onChange(namespace);
      }
    }
  }, [disabled, namespace, value, onChange]);

  return <Original {...props} />;
}

function RequestBodyWithSchema({ Original, ...props }: UntypedProps & { Original: React.ElementType }) {
  const schema = useMemo<SchemaType>(() => {
    const content = props.requestBody.get('content');
    const mime = content?.get('application/json') ?? content?.get('*/*');
    return mime?.get('schema')?.toJS();
  }, [props.requestBody]);

  return (
    <SchemaContext.Provider value={schema}>
      <Original {...props} />
    </SchemaContext.Provider>
  );
}

function ModelExampleWithSchema({ Original, ...props }: UntypedProps & { Original: React.ElementType }) {
  const schema = useMemo<SchemaType>(() => props.schema?.toJS(), [props.schema]);
  if (props.isExecute && schema) {
    return (
      <SchemaContext.Provider value={schema}>
        <Original {...props} />
      </SchemaContext.Provider>
    );
  }
  return <Original {...props} />;
}

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
      RequestBody: (Original: React.ElementType) => (props: UntypedProps) => (
        <RequestBodyWithSchema Original={Original} {...props} />
      ),

      modelExample: (Original: React.ElementType) => (props: UntypedProps) => (
        <ModelExampleWithSchema Original={Original} {...props} />
      ),

      JsonSchemaForm: (Original: React.ElementType) => (props: UntypedProps) => {
        const { description, disabled, required, onChange, value } = props;
        if (required && description === 'namespace') {
          return <NamespaceInput Original={Original} {...props} />;
        }
        if (!disabled && required) {
          switch (description) {
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
            {(schema) =>
              schema ? (
                <Suspense fallback={<Original {...props} />}>
                  <SchemaEditor {...props} onChange={props.onChange} schema={schema} />
                </Suspense>
              ) : (
                <Original {...props} />
              )
            }
          </SchemaContext.Consumer>
        );
      },
    },
  };
};
