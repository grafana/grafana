import React from 'react';
import { AutoSizer } from 'react-virtualized';

/** This will add full size with & height properties */
export const withFullSizeStory = (component: React.ComponentType<any>, props: any) => (
  <div
    style={{
      height: '100vh',
      width: '100%',
    }}
  >
    <AutoSizer>
      {({ width, height }) => (
        <>
          {React.createElement(component, {
            ...props,
            width,
            height,
          })}
        </>
      )}
    </AutoSizer>
  </div>
);
