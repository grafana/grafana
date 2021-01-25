import React from 'react';
import { action } from '@storybook/addon-actions';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Card, Props } from './Card';
import mdx from './Card.mdx';
import { Button } from '../Button';
import { IconButton } from '../IconButton/IconButton';
import { TagList } from '../Tags/TagList';

const logo = 'https://grafana.com/static/assets/img/apple-touch-icon.png';

export default {
  title: 'General/Card',
  component: Card,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  argTypes: {
    heading: { control: { disable: true } },
    description: { control: { disable: true } },
    href: { control: { disable: true } },
    tooltip: { control: { disable: true } },
    onClick: { control: { disable: true } },
  },
};

export const Basic: Story<Props> = ({ disabled }) => {
  return (
    <Card
      heading="Filter by name"
      description="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const AsLink: Story<Props> = ({ disabled }) => {
  return (
    <Card
      href="https://grafana.com"
      heading="Filter by name"
      description="Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel."
      disabled={disabled}
    />
  );
};

export const WithTooltip: Story<Props> = ({ disabled }) => {
  return (
    <Card
      heading="Reduce"
      description="Reduce all rows or data points to a single value using a function like max, min, mean or last."
      tooltip="Click to apply this transformation."
      disabled={disabled}
    />
  );
};

export const WithTags: Story<Props> = ({ disabled }) => {
  return (
    <Card heading="Elasticsearch – Custom Templated Query" disabled={disabled}>
      <Card.Meta>Elastic Search</Card.Meta>
      <Card.Tags>
        <TagList tags={['elasticsearch', 'test', 'testdata']} onClick={(tag) => console.log('tag', tag)} />
      </Card.Tags>
    </Card>
  );
};

export const WithMedia: Story<Props> = ({ disabled }) => {
  return (
    <Card href="https://ops-us-east4.grafana.net/api/prom" heading="1-ops-tools1-fallback" disabled={disabled}>
      <Card.Meta>
        Prometheus
        <a key="link2" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" />
      </Card.Figure>
    </Card>
  );
};
export const WithActions: Story<Props> = ({ disabled }) => {
  return (
    <Card heading="1-ops-tools1-fallback" disabled={disabled}>
      <Card.Meta>
        Prometheus
        <a key="link2" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" />
      </Card.Figure>
      <Card.Actions>
        <Button key="settings" variant="secondary">
          Settings
        </Button>
        <Button key="explore" variant="secondary">
          Explore
        </Button>
      </Card.Actions>
      <Card.SecondaryActions>
        <IconButton key="showAll" name="apps" tooltip="Show all dashboards for this data source" />
        <IconButton key="delete" name="trash-alt" tooltip="Delete this data source" />
      </Card.SecondaryActions>
    </Card>
  );
};

export const Full: Story<Props> = ({ disabled }) => {
  return (
    <Card
      heading="Card title"
      disabled={disabled}
      description="Description, body text. Greetings! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
    >
      <Card.Meta>
        {['Subtitle', 'Meta info 1', 'Meta info 2']}
        <a key="link" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" />
      </Card.Figure>
      <Card.Tags>
        <TagList tags={['firing', 'active', 'test', 'testdata', 'prometheus']} onClick={action('Clicked tag')} />
      </Card.Tags>
      <Card.Actions>
        <Button key="settings" variant="secondary">
          Main action
        </Button>
        <Button key="explore" variant="secondary">
          2nd action
        </Button>
      </Card.Actions>
      <Card.SecondaryActions>
        <IconButton key="comment-alt" name="comment-alt" tooltip="Tooltip content" />
        <IconButton key="copy" name="copy" tooltip="Tooltip content" />
        <IconButton key="link" name="link" tooltip="Tooltip content" />
        <IconButton key="star" name="star" tooltip="Tooltip content" />
        <IconButton key="delete" name="trash-alt" tooltip="Delete this data source" />
      </Card.SecondaryActions>
    </Card>
  );
};
