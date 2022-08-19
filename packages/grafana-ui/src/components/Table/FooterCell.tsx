import { css } from '@emotion/css';
import React from 'react';

import { KeyValue } from '@grafana/data';

import { FooterItem } from './types';

export interface FooterProps {
  value: FooterItem;
}

export const FooterCell = (props: FooterProps) => {
  const cell = css`
    width: 100%;
    list-style: none;
  `;

  const list = css`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `;

  if (props.value && !Array.isArray(props.value)) {
    return <span>{props.value}</span>;
  }
  if (props.value && Array.isArray(props.value) && props.value.length > 0) {
    return (
      <ul className={cell}>
        {props.value.map((v: KeyValue<string>, i) => {
          const key = Object.keys(v)[0];
          return (
            <li className={list} key={i}>
              <span>{key}:</span>
              <span>{v[key]}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  return EmptyCell;
};

export const EmptyCell = () => {
  return <span>&nbsp;</span>;
};
