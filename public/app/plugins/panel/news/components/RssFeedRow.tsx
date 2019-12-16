import React, { FunctionComponent } from 'react';
import { RssItem } from '../types';

interface Props {
  item: RssItem;
}

export const RssFeedRow: FunctionComponent<Props> = ({ item }) => {
  // moment(item.created).format('LLL')
  return (
    <a href={item.url} target="_blank">
      <div style={{ display: 'flex', padding: '4px 0' }}>
        <div>{'TIME!'}</div>
        <div style={{ marginLeft: '16px' }}>{item.title}</div>
      </div>
    </a>
  );
};
