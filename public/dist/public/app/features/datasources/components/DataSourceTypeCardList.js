import { css } from '@emotion/css';
import React from 'react';
import { List } from '@grafana/ui';
import { DataSourceTypeCard } from './DataSourceTypeCard';
export function DataSourceTypeCardList({ dataSourcePlugins, onClickDataSourceType }) {
    if (!dataSourcePlugins || !dataSourcePlugins.length) {
        return null;
    }
    return (React.createElement(List, { items: dataSourcePlugins, getItemKey: (item) => item.id.toString(), renderItem: (item) => React.createElement(DataSourceTypeCard, { dataSourcePlugin: item, onClick: () => onClickDataSourceType(item) }), className: css `
        > li {
          margin-bottom: 2px;
        }
      ` }));
}
//# sourceMappingURL=DataSourceTypeCardList.js.map