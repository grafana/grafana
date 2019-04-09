import React from 'react';
import { LegendComponentProps } from './Legend';

export const LegendTable: React.FunctionComponent<LegendComponentProps> = ({ items, itemRenderer, statsToDisplay }) => {
  return (
    <ul>
      {items.map((item, index) => {
        return (
          <li key={`${item.label}-${index}`}>
            <>{itemRenderer ? itemRenderer(item) : item.label}</>
          </li>
        );
      })}
    </ul>
  );
};
