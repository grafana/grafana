import React from 'react';
import { Link } from 'react-router-dom';
import { TypesMetadata } from './App'; // TODO:  Remove circular dep

const TypesIndex = ({ typesMetadata }: { typesMetadata: TypesMetadata }) => {
  return (
    <ul style={{ listStyleType: 'none', marginTop: '20px' }}>
      <li style={{ margin: '20px 0 10px 0' }}>
        <h4>Types</h4>
      </li>
      {Object.keys(typesMetadata).map((source: any) => {
        return (
          <li key={source}>
            <Link to={`/types/${source}`}>{source}</Link>
          </li>
        );
      })}
    </ul>
  );
};

export default TypesIndex;
