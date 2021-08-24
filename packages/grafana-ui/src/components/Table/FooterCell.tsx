import React from 'react';

export interface FooterProps {
  values: any[];
}

export const FooterCell = (props: FooterProps) => {
  const hasValues = props.values.filter((v: any) => v !== '' && v !== undefined).length > 0;

  if (props.values && props.values.length > 0 && hasValues) {
    return (
      <ul style={{ listStyle: 'none' }}>
        {props.values.map((v, i) => {
          return (
            <li style={{ textAlign: 'right' }} key={i}>
              {v}
            </li>
          );
        })}
      </ul>
    );
  }
  return EmptyCell;
};

export const EmptyCell = (props: any) => {
  return <span>&nbsp;</span>;
};
