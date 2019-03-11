import React from 'react';
import { Link, RouterChildContext } from 'react-router-dom';

const ComponentsIndex = ({ metadata }: { metadata: any }) => {
  return (
    <ul>
      <li key="readme">
        <Link to="/">Readme</Link>
      </li>
      <li key="changelog">
        <Link to="/changelog">Changelog</Link>
      </li>
      <li>Components</li>
      {metadata.components.map(m => (
        <li key={m.name}>
          <Link to={`/components/${m.name}`}>{m.name}</Link>
        </li>
      ))}
    </ul>
  );
};

export default ComponentsIndex;
