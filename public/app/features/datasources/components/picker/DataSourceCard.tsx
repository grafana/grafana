import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, TagList } from '@grafana/ui';

interface DataSourceCardProps {
  ds: DataSourceInstanceSettings;
  onClick: () => void;
  selected: boolean;
}

export class DataSourceCard extends PureComponent<DataSourceCardProps> {
  render() {
    const { ds, onClick, selected } = this.props;
    return (
      <Card key={ds.uid} onClick={onClick} style={{ cursor: 'pointer', backgroundColor: selected ? '#f5f5f5' : '' }}>
        <Card.Heading>{ds.name}</Card.Heading>
        <Card.Meta>
          {ds.meta.name}
          {ds.meta.info.description}
        </Card.Meta>
        <Card.Figure>
          <img src={ds.meta.info.logos.small} alt={`${ds.meta.name} Logo`} height="40" width="40" />
        </Card.Figure>
        <Card.Tags>{ds.isDefault ? <TagList tags={['default']} /> : null}</Card.Tags>
      </Card>
    );
  }
}
