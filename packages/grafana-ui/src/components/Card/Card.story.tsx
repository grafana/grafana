import { Meta, StoryFn } from '@storybook/react';

import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { TextLink } from '../Link/TextLink';
import { TagList } from '../Tags/TagList';

import { Card } from './Card';

const logo = 'https://grafana.com/static/assets/img/apple-touch-icon.png';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  parameters: {
    controls: {
      exclude: ['onClick', 'href', 'heading', 'description', 'className', 'noMargin'],
    },
  },
};

/**
 * A basic Card component expects at least a heading, used as a title.
 */
export const Basic: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin {...args}>
      <Card.Heading>Filter by name</Card.Heading>
      <Card.Description>
        Filter data by query. This is useful if you are sharing the results from a different panel that has many queries
        and you want to only visualize a subset of that in this panel.
      </Card.Description>
    </Card>
  );
};

/**
 * For providing metadata elements, which can be any extra information for the card, Card.Meta component should be used.
 * If metadata consists of multiple strings, each of them has to be escaped (wrapped in brackets {}) or better passed in as an array.
 */
export const MultipleMetadataElements: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin>
      <Card.Heading>Test dashboard</Card.Heading>
      <Card.Meta>{['Folder: Test', 'Views: 100']}</Card.Meta>
    </Card>
  );
};

/**
 * Metadata also accepts HTML elements, which could be links, for example.
 * For elements, that are not strings, a `key` prop has to be manually specified.
 */
export const ComplexMetadataElements: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin>
      <Card.Heading>Test dashboard</Card.Heading>
      <Card.Meta>
        <>Grafana</>
        <a key="prom-link" href="https://ops-us-east4.grafana.net/api/prom">
          <>https://ops-us-east4.grafana.net/api/prom</>
        </a>
      </Card.Meta>
    </Card>
  );
};

/**
 * The separator for multiple metadata elements defaults to a vertical line `|`, but can be customised.
 */
export const MultipleMetadataWithCustomSeparator: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin>
      <Card.Heading>Test dashboard</Card.Heading>
      <Card.Meta separator={'-'}>
        Grafana
        <TextLink key="prom-link" href="https://ops-us-east4.grafana.net/api/prom" external>
          https://ops-us-east4.grafana.net/api/prom
        </TextLink>
      </Card.Meta>
    </Card>
  );
};

/**
 * Tags can be rendered inside the Card, by being wrapped in `Card.Tags` component.
 * Note that this component does not provide any tag styling and that should be handled by the children.
 * It is recommended to use it with Grafana-UI's `TagList` component.
 */
export const Tags: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin>
      <Card.Heading>Test dashboard</Card.Heading>
      <Card.Description>Card with a list of tags</Card.Description>
      <Card.Tags>
        <TagList tags={['tag1', 'tag2', 'tag3']} onClick={(tag) => console.log(tag)} />
      </Card.Tags>
    </Card>
  );
};

/**
 * Card can be used as a clickable link item by specifying `href` prop.
 */
export const AsALink: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin href="https://grafana.com">
      <Card.Heading>Redirect to Grafana</Card.Heading>
      <Card.Description>Clicking this card will redirect to grafana website</Card.Description>
    </Card>
  );
};

/**
 * Card can be used as a clickable buttons item by specifying `onClick` prop.
 * **Note:** When used in conjunction with [Metadata elements](#multiple-metadata-elements), clicking on any element
 * inside `<Card.Meta>` will prevent the card action to be executed (either `href` to be followed or `onClick` to be called).
 */
export const AsAButton: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin onClick={() => alert('Hello, Grafana!')}>
      <Card.Heading>Hello, Grafana</Card.Heading>
      <Card.Description>Clicking this card will create an alert</Card.Description>
    </Card>
  );
};

/**
 * To render cards in a list, it is possible to nest them inside `li` items.
 */
export const InsideAListItem: StoryFn<typeof Card> = (args) => {
  return (
    <ul style={{ padding: '20px', listStyle: 'none', display: 'grid', gap: '8px' }}>
      <li>
        <Card noMargin>
          <Card.Heading>List card item</Card.Heading>
          <Card.Description>Card that is rendered inside li element.</Card.Description>
        </Card>
      </li>
      <li>
        <Card noMargin>
          <Card.Heading>List card item</Card.Heading>
          <Card.Description>Card that is rendered inside li element.</Card.Description>
        </Card>
      </li>
      <li>
        <Card noMargin>
          <Card.Heading>List card item</Card.Heading>
          <Card.Description>Card that is rendered inside li element.</Card.Description>
        </Card>
      </li>
      <li>
        <Card noMargin>
          <Card.Heading>List card item</Card.Heading>
          <Card.Description>Card that is rendered inside li element.</Card.Description>
        </Card>
      </li>
    </ul>
  );
};

/**
 * Cards can also be rendered with media content such as icons or images. Such elements need to be wrapped in `Card.Figure` component.
 */
export const WithMediaElements: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin>
      <Card.Heading>1-ops-tools1-fallback</Card.Heading>
      <Card.Figure>
        <img src={logo} alt="Grafana Logo" width="40" height="40" />
      </Card.Figure>
      <Card.Meta>
        Grafana
        <TextLink key="prom-link" href="https://ops-us-east4.grafana.net/api/prom" external>
          https://ops-us-east4.grafana.net/api/prom
        </TextLink>
      </Card.Meta>
    </Card>
  );
};

/**
 * Cards also accept primary and secondary actions. Usually the primary actions are displayed as buttons
 * while secondary actions are displayed as icon buttons. The actions need to be wrapped in `Card.Actions`
 * and `Card.SecondaryActions` components respectively.
 */
export const ActionCards: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin {...args}>
      <Card.Heading>1-ops-tools1-fallback</Card.Heading>
      <Card.Meta>
        Prometheus
        <TextLink key="link2" href="https://ops-us-east4.grafana.net/api/prom" external>
          https://ops-us-east4.grafana.net/api/prom
        </TextLink>
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

/**
 * Card can have a disabled state, effectively making it and its actions non-clickable.
 * If there are any actions, they will be disabled instead of the whole card.
 */
export const DisabledState: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin disabled>
      <Card.Heading>1-ops-tools1-fallback</Card.Heading>
      <Card.Meta>
        Grafana
        <TextLink key="prom-link" href="https://ops-us-east4.grafana.net/api/prom" external>
          https://ops-us-east4.grafana.net/api/prom
        </TextLink>
      </Card.Meta>
      <Card.Figure>
        <img src={logo} alt="Grafana Logo" width="40" height="40" />
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

export const Selectable: StoryFn<typeof Card> = () => {
  return (
    <Card noMargin isSelected disabled>
      <Card.Heading>Option #1</Card.Heading>
      <Card.Description>This is a really great option, you will not regret it.</Card.Description>
      <Card.Figure>
        <img src={logo} alt="Grafana Logo" width="40" height="40" />
      </Card.Figure>
    </Card>
  );
};

export const Full: StoryFn<typeof Card> = (args) => {
  return (
    <Card noMargin {...args}>
      <Card.Heading>Card title</Card.Heading>
      <Card.Description>
        Description, body text. Greetings! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
        laboris nisi ut aliquip ex ea commodo consequat.
      </Card.Description>
      <Card.Meta>
        {['Subtitle', 'Meta info 1', 'Meta info 2']}
        <TextLink key="link" href="https://ops-us-east4.grafana.net/api/prom" external>
          https://ops-us-east4.grafana.net/api/prom
        </TextLink>
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

export default meta;
