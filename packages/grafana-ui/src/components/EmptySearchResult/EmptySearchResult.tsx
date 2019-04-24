import React, { FC } from 'react';

export interface Props {
  children: JSX.Element | string;
}

const EmptySearchResult: FC<Props> = ({ children }) => {
  return <div className="empty-search-result">{children}</div>;
};

export { EmptySearchResult };
