import React from 'react';
import { Link } from 'react-router-dom';

const ComponentsIndex = ({ metadata }: { metadata: any }) => {
  return (
    <ul style={{ listStyleType: 'none', marginTop: '20px' }}>
      <li key="readme">
        <Link to="/">Readme</Link>
      </li>
      <li key="changelog">
        <Link to="/changelog">Changelog</Link>
      </li>

      <li style={{ margin: '20px 0 10px 0' }}>
        <h4>Components</h4>
      </li>
      {metadata.components.map((comp: any) => {
        return (
          <li key={comp.name}>
            <Link to={`/components/${comp.name}`}>{comp.name}</Link>
            {!comp.docs && <span style={{ color: 'red', fontSize: '10px' }}>No docs yet!</span>}
          </li>
        );
      })}
      <li style={{ margin: '20px 0 10px 0' }}>
        <h4>TODO Guidelines</h4>
      </li>
    </ul>
  );
};

export default ComponentsIndex;
