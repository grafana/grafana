import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import { IconButton } from '../IconButton/IconButton';
import { VerticalGroup } from '../Layout/Layout';
import { TagList } from '../Tags/TagList';

import { Card } from './Card';
import mdx from './Card.mdx';

const logo = 'https://grafana.com/static/assets/img/apple-touch-icon.png';

const meta: ComponentMeta<typeof Card> = {
  title: 'General/Card',
  component: Card,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onClick', 'href', 'heading', 'description', 'className'],
    },
  },
};

export const Basic: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <Card disabled={disabled}>
      <Card.Heading>Filter by name</Card.Heading>
      <Card.Description>
        Filter data by query. This is useful if you are sharing the results from a different panel that has many queries
        and you want to only visualize a subset of that in this panel.
      </Card.Description>
    </Card>
  );
};

export const AsLink: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <VerticalGroup>
      <Card href="https://grafana.com" disabled={disabled}>
        <Card.Heading>Filter by name</Card.Heading>
        <Card.Description>
          Filter data by query. This is useful if you are sharing the results from a different panel that has many
          queries and you want to only visualize a subset of that in this panel.
        </Card.Description>
      </Card>
      <Card href="https://grafana.com" disabled={disabled}>
        <Card.Heading>Filter by name2</Card.Heading>
        <Card.Description>
          Filter data by query. This is useful if you are sharing the results from a different panel that has many
          queries and you want to only visualize a subset of that in this panel.
        </Card.Description>
      </Card>
      <Card href="https://grafana.com" disabled={disabled}>
        <Card.Heading>Production system overview</Card.Heading>
        <Card.Meta>Meta tags</Card.Meta>
      </Card>
    </VerticalGroup>
  );
};

export const WithTags: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <Card disabled={disabled}>
      <Card.Heading>Elasticsearch – Custom Templated Query</Card.Heading>
      <Card.Meta>Elastic Search</Card.Meta>
      <Card.Tags>
        <TagList tags={['elasticsearch', 'test', 'testdata']} onClick={(tag) => console.log('tag', tag)} />
      </Card.Tags>
    </Card>
  );
};

export const WithMedia: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <Card disabled={disabled}>
      <Card.Heading>1-ops-tools1-fallback</Card.Heading>
      <Card.Meta>
        Prometheus
        <a key="link2" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" height="40" width="40" />
      </Card.Figure>
    </Card>
  );
};
export const WithActions: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <Card disabled={disabled}>
      <Card.Heading>1-ops-tools1-fallback</Card.Heading>
      <Card.Meta>
        Prometheus
        <a key="link2" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" height="40" width="40" />
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

export const Full: ComponentStory<typeof Card> = ({ disabled }) => {
  return (
    <Card disabled={disabled}>
      <Card.Heading>Card title</Card.Heading>
      <Card.Description>
        Description, body text. Greetings! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
        laboris nisi ut aliquip ex ea commodo consequat.
      </Card.Description>
      <Card.Meta>
        {['Subtitle', 'Meta info 1', 'Meta info 2']}
        <a key="link" href="https://ops-us-east4.grafana.net/api/prom">
          https://ops-us-east4.grafana.net/api/prom
        </a>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Prometheus Logo" height="40" width="40" />
      </Card.Figure>
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

export const Selected: ComponentStory<typeof Card> = () => {
  return (
    <Card isSelected>
      <Card.Heading>Spaces</Card.Heading>
      <Card.Description>Spaces are the superior form of indenting code.</Card.Description>
      <Card.Figure>
        <img src={logo} alt="Grafana Logo" width="40" height="40" />
      </Card.Figure>
    </Card>
  );
};

export const NotSelected: ComponentStory<typeof Card> = () => {
  return (
    <Card isSelected={false}>
      <Card.Heading>Tabs</Card.Heading>
      <Card.Description>Tabs are the preferred way of indentation.</Card.Description>
      <Card.Figure>
        <img src={logo} alt="Grafana Logo" width="40" height="40" />
      </Card.Figure>
    </Card>
  );
};

export default meta;
