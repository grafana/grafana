import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import ComponentsIndex from './ComponentsIndex';
import Markdown from 'markdown-to-jsx';

interface ComponentDocs {
  name: string; // MD
  docs?: string; // MD
  path?: string; // Component path -> relative to WAT?!
  meta: {
    category: string;
    description: string;
    props: any;
  };
}

interface AppProps {
  docsMetadata: {
    readme: string;
    changelog: string;
    components: ComponentDocs[];
  };
}

const App = ({ docsMetadata }: AppProps) => {
  return (
    <BrowserRouter>
      <>
        <ComponentsIndex metadata={docsMetadata} />
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
              const componentMetadata = docsMetadata.components.filter(c => c.name === params.component)[0].docs;
              console.log(docsMetadata);
              return <h1>Cmp</h1>;
            }}
          />

          <Route render={() => <h1>Not found</h1>} />
        </Switch>
      </>
    </BrowserRouter>
  );
};

export default App;
