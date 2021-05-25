import React from 'react';
import { DataSourceSettings, getDefaultTimeRange, serializeStateToUrlParam } from '@grafana/data';
import { Card, IconButton, LinkButton, Tag } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  dataSources: DataSourceSettings[];
  onDeleteClick: (id: number) => void;
}

export const DataSourcesList = ({ dataSources, onDeleteClick }: Props) => (
  <ul className={listStyles}>
    {dataSources.map((dataSource) => (
      <li key={dataSource.id}>
        <Card heading={dataSource.name}>
          <Card.Figure>
            <img src={dataSource.typeLogoUrl} alt={dataSource.name} />
          </Card.Figure>

          <Card.Meta>
            {[
              dataSource.typeName,
              dataSource.url,
              dataSource.isDefault && <Tag key="default-tag" name="default" colorIndex={1} />,
            ]}
          </Card.Meta>

          <Card.Actions>
            <LinkButton variant="secondary" href={`datasources/edit/${dataSource.uid}`}>
              Settings
            </LinkButton>
            <LinkButton
              variant="secondary"
              href={`explore?left=${serializeStateToUrlParam({
                datasource: dataSource.uid,
                range: getDefaultTimeRange().raw,
                queries: [],
              })}`}
            >
              Explore
            </LinkButton>
          </Card.Actions>

          <Card.SecondaryActions>
            <IconButton
              aria-label="Delete"
              disabled={dataSource.readOnly}
              name="trash-alt"
              tooltip="Delete this data source"
              onClick={() => onDeleteClick(dataSource.id)}
            />
          </Card.SecondaryActions>
        </Card>
      </li>
    ))}
  </ul>
);

const listStyles = css`
  list-style: none;
`;
