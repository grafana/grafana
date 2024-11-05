import { css } from '@emotion/css';
import { Property } from 'csstype';

import { fieldReducers, KeyValue, ReducerID } from '@grafana/data';

export type FooterItem = Array<KeyValue<string>> | string | undefined;

export interface FooterProps {
  value: FooterItem;
  justifyContent?: Property.JustifyContent;
}

export const FooterCell = (props: FooterProps) => {
  const cell = css({
    width: '100%',
    listStyle: 'none',
  });

  const item = css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: props.justifyContent || 'space-between',
  });

  const list = css({
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  });

  if (props.value && !Array.isArray(props.value)) {
    return <span className={item}>{props.value}</span>;
  }

  if (props.value && Array.isArray(props.value) && props.value.length > 0) {
    return (
      <ul className={cell}>
        {props.value.map((v: KeyValue<string>, i) => {
          const key = Object.keys(v)[0];
          return (
            <li className={list} key={i}>
              <span>{key}</span>
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

export function getFooterValue(
  index: number,
  footerValues?: FooterItem[],
  isCountRowsSet?: boolean,
  justifyContent?: Property.JustifyContent
) {
  if (footerValues === undefined) {
    return EmptyCell;
  }

  if (isCountRowsSet) {
    if (footerValues[index] === undefined) {
      return EmptyCell;
    }

    const key = fieldReducers.get(ReducerID.count).name;

    return FooterCell({ value: [{ [key]: String(footerValues[index]) }] });
  }

  return FooterCell({ value: footerValues[index], justifyContent });
}
