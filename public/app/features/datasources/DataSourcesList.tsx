// Libraries
import { css } from '@emotion/css';
import React from 'react';
import { useSelector } from 'react-redux';

// Types
import { Card, Tag, useStyles } from '@grafana/ui';
import { StoreState } from 'app/types';

import { getDataSources } from './state/selectors';

export const DataSourcesList = () => {
  const dataSources = useSelector((state: StoreState) => getDataSources(state.dataSources));
  const styles = useStyles(getStyles);

  return (
    <ul className={styles.list}>
      {dataSources.map((dataSource) => {
        return (
          <li key={dataSource.id}>
            <Card href={`datasources/edit/${dataSource.uid}`}>
              <Card.Heading>{dataSource.name}</Card.Heading>
              <Card.Figure>
                <img src={dataSource.typeLogoUrl} alt="" height="40px" width="40px" className={styles.logo} />
              </Card.Figure>
              <Card.Meta>
                {[
                  dataSource.typeName,
                  dataSource.url,
                  dataSource.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
                ]}
              </Card.Meta>
            </Card>
          </li>
        );
      })}
    </ul>
  );
};

export default DataSourcesList;

const getStyles = () => {
  return {
    list: css({
      listStyle: 'none',
      display: 'grid',
      // gap: '8px', Add back when legacy support for old Card interface is dropped
    }),
    logo: css({
      objectFit: 'contain',
    }),
  };
};
