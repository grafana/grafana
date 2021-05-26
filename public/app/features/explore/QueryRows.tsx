// Libraries
import React, { PureComponent } from 'react';

// Components
import QueryRow from './QueryRow';

// Types
import { ExploreId } from 'app/types/explore';

interface QueryRowsProps {
  className?: string;
  exploreId: ExploreId;
  queryKeys: string[];
}

export default class QueryRows extends PureComponent<QueryRowsProps> {
  render() {
    const { className = '', exploreId, queryKeys } = this.props;
    return (
      <div className={className}>
        {queryKeys.map((key, index) => {
          return <QueryRow key={key} exploreId={exploreId} index={index} />;
        })}
      </div>
    );
  }
}
