import React, { PureComponent } from 'react';

import { Emitter } from 'app/core/utils/emitter';
import { DataQuery } from 'app/types';
import { ExploreId } from 'app/types/explore';

import QueryRow from './QueryRow';

interface QueryRowsProps {
  className?: string;
  exploreEvents: Emitter;
  exploreId: ExploreId;
  initialQueries: DataQuery[];
}
export default class QueryRows extends PureComponent<QueryRowsProps> {
  render() {
    const { className = '', exploreEvents, exploreId, initialQueries } = this.props;
    return (
      <div className={className}>
        {initialQueries.map((query, index) => (
          // TODO instead of relying on initialQueries, move to react key list in redux
          <QueryRow key={query.key} exploreEvents={exploreEvents} exploreId={exploreId} index={index} />
        ))}
      </div>
    );
  }
}
