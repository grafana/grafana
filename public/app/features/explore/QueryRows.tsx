// Libraries
import React, { PureComponent } from 'react';

// Components
import QueryRow from './QueryRow';

// Types
import { Emitter } from 'app/core/utils/emitter';
import { ExploreId } from 'app/types/explore';

interface QueryRowsProps {
  className?: string;
  exploreEvents: Emitter;
  exploreId: ExploreId;
  queryKeys: string[];
}

export default class QueryRows extends PureComponent<QueryRowsProps> {
  render() {
    const { className = '', exploreEvents, exploreId, queryKeys } = this.props;
    return (
      <div className={className}>
        {queryKeys.map((key, index) => {
          return <QueryRow key={key} exploreEvents={exploreEvents} exploreId={exploreId} index={index} />;
        })}
      </div>
    );
  }
}
