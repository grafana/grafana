import { css } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, GrafanaTheme2 } from '@grafana/data';
import { Card, PluginSignatureBadge, Tag, useStyles2 } from '@grafana/ui';

export interface DataSourceCardProps {
  onChange: (uid: string) => void;
  selected?: boolean;
  ds: DataSourceInstanceSettings<DataSourceJsonData>;
}

export function DataSourceCard(props: DataSourceCardProps) {
  const { selected, ds, onChange } = props;
  const styles = useStyles2(getStyles);
  return (
    <Card className={selected ? styles.selectedDataSource : undefined} key={ds.uid} onClick={() => onChange(ds.uid)}>
      <Card.Figure>
        <img alt={`${ds.meta.name} logo`} src={ds.meta.info.logos.large}></img>
      </Card.Figure>
      <Card.Meta>
        {[ds.meta.name, ds.url, ds.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />]}
      </Card.Meta>
      <Card.Tags>
        <PluginSignatureBadge status={ds.meta.signature} />
      </Card.Tags>
      <Card.Heading>{ds.name}</Card.Heading>
    </Card>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    selectedDataSource: css`
      background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.1)};
    `,
  };
}
