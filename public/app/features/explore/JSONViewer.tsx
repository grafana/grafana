import React from 'react';

export default function({ value }: any) {
  return (
    <div>
      <pre>{JSON.stringify(value, undefined, 2)}</pre>
    </div>
  );
}
