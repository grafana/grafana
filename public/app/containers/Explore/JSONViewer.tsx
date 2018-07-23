import React from 'react';

export default function({ value }) {
  return (
    <div>
      <pre>{JSON.stringify(value, undefined, 2)}</pre>
    </div>
  );
}
