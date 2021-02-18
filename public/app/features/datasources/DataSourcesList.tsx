// Libraries
import React, { FC } from 'react';
import classNames from 'classnames';

// Types
import { DataSourceSettings } from '@grafana/data';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
import { Card, Tag, useStyles } from '@grafana/ui';
import { css } from 'emotion';

export interface Props {
  dataSources: DataSourceSettings[];
  layoutMode: LayoutMode;
}

export const DataSourcesList: FC<Props> = ({ dataSources, layoutMode }) => {
  const listStyle = classNames({
    'card-section': true,
    'card-list-layout-grid': layoutMode === LayoutModes.Grid,
    'card-list-layout-list': layoutMode === LayoutModes.List,
  });
  const styles = useStyles(getStyles);

  return (
    <section className={listStyle}>
      <ul className={styles.list}>
        {dataSources.map((dataSource, index) => {
          return (
            <li key={`${dataSource.id}-${index}`}>
              <Card heading={dataSource.name} href={`datasources/edit/${dataSource.id}`}>
                <Card.Figure>
                  <img src={dataSource.typeLogoUrl} alt={dataSource.name} />
                </Card.Figure>
                <Card.Meta>
                  {[
                    dataSource.url,
                    dataSource.type?.toUpperCase(),
                    dataSource.isDefault && <Tag name={'default'} colorIndex={1} />,
                  ].filter(Boolean)}
                </Card.Meta>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DataSourcesList;

const getStyles = () => {
  return {
    list: css`
      list-style: none;
    `,
  };
};
