import React from 'react';
import { TypeDefinition } from './App';

// @ts-ignore
import Markdown from 'markdown-to-jsx';
import JSONTree from 'react-json-tree';
interface ComponentDocsPageProps {
  typesMetadata: TypeDefinition[];
  sourceFile: string;
}

const TypesDocsPage = ({ sourceFile, typesMetadata }: ComponentDocsPageProps) => {
  return (
    <>
      <h1>{sourceFile}</h1>
      <div>
        <h3>debug</h3>
        <JSONTree data={typesMetadata} />
      </div>
    </>
  );
};

export default TypesDocsPage;
