import React from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import ComponentsIndex from './ComponentsIndex';

// @ts-ignore
import Markdown from 'markdown-to-jsx';
import Sidebar from './Sidebar';
import ComponentDocsPage from './ComponentDocsPage';
import TypesDocsPage from './TypesDocsPage';
import TypesIndex from './TypesIndex';

export interface ComponentDocs {
  name: string; // MD
  docs?: string; // MD
  path?: string; // Component path -> relative to WAT?!
  meta: {
    category: string;
    description: string;
    props: any;
  };
}

export interface TypeDefinition {
  name: string;
  definition: string;
  sourceFileName: string;
  sourceFilePath: string;
}
export interface TypesMetadata {
  [key: string]: TypeDefinition[];
}

interface AppProps {
  docsMetadata: {
    readme: string;
    changelog: string;
    components: ComponentDocs[];
    types: TypesMetadata;
  };
  onThemeChange: (theme: string) => void;
}

const App = ({ docsMetadata, onThemeChange }: AppProps) => {
  return (
    <HashRouter>
      <div style={{ display: 'flex' }}>
        <Sidebar onThemeSelect={onThemeChange}>
          <>
            <ComponentsIndex metadata={docsMetadata} />
            <TypesIndex typesMetadata={docsMetadata.types} />
          </>
        </Sidebar>

        <div
          style={{
            height: '100vh',
            overflow: 'scroll',
            width: 'calc(100% - 300px)',
            padding: '20px',
          }}
        >
          <Switch>
            <Route
              exact
              path="/"
              render={({ match: { params } }) => {
                return <Markdown>{docsMetadata.readme}</Markdown>;
              }}
            />
            <Route
              exact
              path="/changelog"
              render={({ match: { params } }) => {
                return <Markdown>{docsMetadata.changelog}</Markdown>;
              }}
            />
            <Route
              exact
              path="/components/:component"
              render={({ match: { params } }) => {
                const componentMetadata = docsMetadata.components.filter(c => c.name === params.component)[0];
                return <ComponentDocsPage componentMetadata={componentMetadata} />;
              }}
            />
            <Route
              exact
              path="/types/:sourceFile"
              render={({ match: { params } }) => {
                const typesMetadata = docsMetadata.types[params.sourceFile];
                return <TypesDocsPage sourceFile={params.sourceFile} typesMetadata={typesMetadata} />;
              }}
            />

            <Route render={() => <h1>Not found</h1>} />
          </Switch>
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
