import React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Card } from './Card';
import mdx from './Card.mdx';
import promLogo from '../../../../../public/app/plugins/datasource/prometheus/img/prometheus_logo.svg';
import { Button } from '../Button';
import { IconButton } from '../IconButton/IconButton';

export default {
  title: 'General/Card',
  component: Card,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const getKnobs = () => {
  const disabled = boolean('Disabled', false, 'Style props');

  return { disabled };
};

export const Basic = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Filter by name"
      metaData="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const AsLink = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      href="https://grafana.com"
      title="Filter by name"
      metaData="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const WithTooltip = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Reduce"
      metaData="Reduce all rows or data points to a single value using a function like max, min, mean or last."
      tooltip="Click to apply this transformation."
      disabled={disabled}
    />
  );
};

export const WithTags = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="Elasticsearch – Custom Templated Query"
      metaData="Elastic Search"
      tags={['elasticsearch', 'test', 'testdata']}
      disabled={disabled}
    />
  );
};

export const WithMedia = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      href="https://ops-us-east4.grafana.net/api/prom"
      aria-label={'t'}
      title="1-ops-tools1-fallback"
      metaData={[
        'Prometheus',
        <a key="link2" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>,
      ]}
      disabled={disabled}
      mediaContent={<img src={promLogo} alt="Prometheus Logo" />}
    />
  );
};
export const WithActions = () => {
  const { disabled } = getKnobs();
  return (
    <Card
      title="1-ops-tools1-fallback"
      metaData={[
        'Prometheus',
        <a key="link" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>,
      ]}
      disabled={disabled}
      mediaContent={<img src={promLogo} alt="Prometheus Logo" />}
      actions={[
        <Button key="settings" variant="secondary">
          Settings
        </Button>,
        <Button key="explore" variant="secondary">
          Explore
        </Button>,
      ]}
      secondaryActions={[
        <IconButton key="showAll" name="apps" tooltip="Show all dashboards for this data source" />,
        <IconButton key="delete" name="trash-alt" tooltip="Delete this data source" />,
      ]}
    />
  );
};
