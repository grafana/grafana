// Libraries
import React, { PureComponent } from 'react';

// Components
import QueryRow from './QueryRow';

// Types
import { Emitter } from 'app/core/utils/emitter';
import { DataQuery } from '@grafana/ui/src/types';
import { ExploreId } from 'app/types/explore';

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
        {initialQueries.map((query, index) => {
          // using query.key will introduce infinite loop because QueryEditor#53
          const key = query.datasource ? `${query.datasource}-${index}` : query.key;
          return <QueryRow key={key} exploreEvents={exploreEvents} exploreId={exploreId} index={index} />;
        })}
      </div>
    );
  }
}
