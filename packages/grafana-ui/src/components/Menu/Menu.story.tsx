import { css } from '@emotion/css';
import { type Meta } from '@storybook/react-webpack5';

import { useTheme2 } from '../../themes/ThemeContext';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';
import { SeriesIcon } from '../VizLegend/SeriesIcon';

import { Menu } from './Menu';
import mdx from './Menu.mdx';

const meta: Meta<typeof Menu> = {
  title: 'Overlays/Menu',
  component: Menu,
  argTypes: {},
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      disabled: true,
    },
    actions: {
      disabled: true,
    },
  },
};

export function Examples() {
  const theme = useTheme2();
  return (
    <Stack direction="column" width="fit-content">
      <StoryExample name="Plain">
        <Menu>
          <Menu.Item label="Google" />
          <Menu.Item label="Filter" />
          <Menu.Item label="Active" active />
          <Menu.Item label="I am a link" url="http://google.com" target="_blank" role="menuitem" />
          <Menu.Item label="With destructive prop set" destructive />
        </Menu>
      </StoryExample>
      <StoryExample name="With icons and a divider">
        <Menu>
          <Menu.Item label="Google" icon="search-plus" />
          <Menu.Item label="Filter" icon="filter" />
          <Menu.Item label="History" icon="history" />
          <Menu.Divider />
          <Menu.Item label="With destructive prop set" icon="trash-alt" destructive />
        </Menu>
      </StoryExample>
      <StoryExample name="With item menu description">
        <Menu>
          <Menu.Item label="item1" icon="history" description="item 1 is an important element" shortcut="q p" />
          <Menu.Item
            label="Item with a very long title"
            icon="apps"
            description="long titles can be hard to read"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item
                key="subitem3"
                label="subitem3"
                icon="search-plus"
                childItems={[
                  <Menu.Item key="subitem1" label="subitem1" icon="history" />,
                  <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
                  <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
                ]}
              />,
            ]}
            shortcut="p s"
          />
          <Menu.Item
            label="item3"
            icon="filter"
            description="item 3 is an important element"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" description="a subitem with a description" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
            ]}
          />
        </Menu>
      </StoryExample>

      <StoryExample name="With disabled items">
        <Menu>
          <Menu.Item label="Google" icon="search-plus" />
          <Menu.Item label="Disabled action" icon="history" disabled />
          <Menu.Item
            label="Disabled link"
            icon="external-link-alt"
            url="http://google.com"
            target="_blank"
            disabled
            role="menuitem"
          />
          <Menu.Item
            label="Submenu"
            icon="apps"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" disabled />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
            ]}
          />
          <Menu.Item
            label="Disabled submenu"
            icon="apps"
            disabled
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
            ]}
          />
          <Menu.Item label="Disabled destructive action" icon="trash-alt" destructive disabled />
        </Menu>
      </StoryExample>
      <StoryExample name="With icon colors">
        <Menu>
          <Menu.Item label="Primary" icon="star" iconColor={theme.colors.primary.text} />
          <Menu.Item label="Secondary" icon="cog" iconColor={theme.colors.secondary.text} />
          <Menu.Item label="Success" icon="plus" iconColor={theme.colors.success.text} />
          <Menu.Item label="Warning" icon="bell" iconColor={theme.colors.warning.text} />
          <Menu.Item label="Purple" icon="download-alt" iconColor="#B877D9" />
          <Menu.Divider />
          <Menu.Item
            label="Destructive wins over iconColor"
            icon="trash-alt"
            iconColor={theme.colors.success.text}
            destructive
          />
          <Menu.Item label="Disabled wins over iconColor" icon="lock" iconColor={theme.colors.success.text} disabled />
        </Menu>
      </StoryExample>
      <StoryExample name="With header & groups">
        <Menu
          header={
            <Stack direction="column" gap={0}>
              <Text variant="bodySmall" weight="medium">
                2020-11-25 19:04:25
              </Text>
              <Stack direction="row" alignItems="center">
                <SeriesIcon color="#00ff00" />
                <Text variant="bodySmall">A-series</Text>
                <Text variant="bodySmall" color="secondary">
                  128 km/h
                </Text>
              </Stack>
            </Stack>
          }
          ariaLabel="Menu header"
        >
          <Menu.Group label="Group 1">
            <Menu.Item label="item1" icon="history" />
            <Menu.Item label="item2" icon="filter" />
          </Menu.Group>
          <Menu.Group label="Group 2">
            <Menu.Item label="item1" icon="history" />
          </Menu.Group>
        </Menu>
      </StoryExample>
      <StoryExample name="With custom spacing (via className)">
        <Stack direction="row" gap={4}>
          <Stack direction="column" gap={2}>
            <div>Default spacing</div>
            <Menu>
              <Menu.Group label="New dashboard">
                <Menu.Item label="Blank" icon="plus" iconColor={theme.colors.success.text} />
                <Menu.Item label="From template" icon="table" iconColor={theme.colors.success.text} />
                <Menu.Item label="Import" icon="download-alt" iconColor={theme.colors.success.text} />
              </Menu.Group>
              <Menu.Divider />
              <Menu.Group label="New alert rule">
                <Menu.Item label="Create" icon="plus" iconColor={theme.colors.success.text} />
                <Menu.Item label="Import" icon="download-alt" iconColor={theme.colors.success.text} />
              </Menu.Group>
            </Menu>
          </Stack>
          <Stack direction="column" gap={2}>
            <div>Custom style</div>
            <Menu style={{ padding: theme.spacing(1, 2) }}>
              <Menu.Group label="New dashboard">
                <Menu.Item
                  label="Blank"
                  icon="plus"
                  iconColor={theme.colors.success.text}
                  className={css({ padding: theme.spacing(1, 2), minHeight: theme.spacing(5) })}
                />
                <Menu.Item
                  label="From template"
                  icon="table"
                  iconColor={theme.colors.success.text}
                  className={css({ padding: theme.spacing(1, 2), minHeight: theme.spacing(5) })}
                />
                <Menu.Item
                  label="Import"
                  icon="download-alt"
                  iconColor={theme.colors.success.text}
                  className={css({ padding: theme.spacing(1, 2), minHeight: theme.spacing(5) })}
                />
              </Menu.Group>
              <Menu.Divider />
              <Menu.Group label="New alert rule">
                <Menu.Item
                  label="Create"
                  icon="plus"
                  iconColor={theme.colors.success.text}
                  className={css({ padding: theme.spacing(1, 2), minHeight: theme.spacing(5) })}
                />
                <Menu.Item
                  label="Import"
                  icon="download-alt"
                  iconColor={theme.colors.success.text}
                  className={css({ padding: theme.spacing(1, 2), minHeight: theme.spacing(5) })}
                />
              </Menu.Group>
            </Menu>
          </Stack>
        </Stack>
      </StoryExample>
      <StoryExample name="With submenu and shortcuts">
        <Menu>
          <Menu.Item label="item1" icon="history" shortcut="q p" />
          <Menu.Item
            label="Item with a very long title"
            icon="apps"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item
                key="subitem3"
                label="subitem3"
                icon="search-plus"
                childItems={[
                  <Menu.Item key="subitem1" label="subitem1" icon="history" />,
                  <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
                  <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
                ]}
              />,
            ]}
            shortcut="p s"
          />
          <Menu.Item
            label="item3"
            icon="filter"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
            ]}
          />
        </Menu>
      </StoryExample>
    </Stack>
  );
}

export default meta;
