import React from 'react';
import { ComponentDocs } from './App';

// @ts-ignore
import Markdown from 'markdown-to-jsx';
import JSONTree from 'react-json-tree';
import { LiveProvider, LivePreview, LiveEditor, LiveError } from 'react-live';
interface ComponentDocsPageProps {
  componentMetadata: ComponentDocs;
}
import * as GrafanaUIComponents from '../../src/components';

const ComponentDocsPage = ({ componentMetadata }: ComponentDocsPageProps) => {
  const { docs, meta, name } = componentMetadata;

  // TODO: There might be multiple components in one file, thus we need to figure out how to select the propper one
  const componentProps = meta.props[0].props;

  return (
    <>
      <h1>{name}</h1>
      <hr />
      {componentMetadata.docs && (
        <Markdown
          options={{
            overrides: {
              code: (markdownProps: any) => {
                if (!markdownProps.className) {
                  return <code>{markdownProps.children}</code>;
                }
                return (
                  <LiveProvider code={markdownProps.children} scope={GrafanaUIComponents}>
                    <div style={{ marginBottom: '20px' }}>
                      <LivePreview />
                    </div>
                    <LiveError />
                    <LiveEditor />
                  </LiveProvider>
                );
              },
            },
          }}
        >
          {docs}
        </Markdown>
      )}
      {!componentMetadata.docs && <h1>{name} is missing markdown file</h1>}

      <h2>Properies</h2>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>
              <b>Prop name</b>
            </th>
            <th>
              <b>Type</b>
            </th>
            <th>
              <b>Description</b>
            </th>
            <th>
              <b>Default value</b>
            </th>
            <th>
              <b>Required</b>
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(componentProps).map(key => {
            return (
              <tr key={key}>
                <td>{componentProps[key].name}</td>
                <td>{componentProps[key].type.name}</td>
                <td>{componentProps[key].description}</td>
                <td>{JSON.stringify(componentProps[key].defaultValue)}</td>
                <td>{componentProps[key].required ? 'true' : 'false'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <hr />
      <div>
        <h3>debug</h3>
        <JSONTree data={componentMetadata} />
      </div>
    </>
  );
};

export default ComponentDocsPage;
