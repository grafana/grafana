import { type Meta, type StoryFn } from '@storybook/react';
import { useState } from 'react';
import { action } from 'storybook/actions';

import { useTheme2 } from '../../themes/ThemeContext';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { hardCodedPalettes } from '../../utils/storybook/hardCodedPalettes';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';
import { LinkButton } from '../LinkButton/LinkButton';

import { Banner, type BannerProps, type BannerThemeColor } from './Banner';
import mdx from './Banner.mdx';
import { type BannerSeverity } from './types';

const severities: BannerSeverity[] = ['error', 'warning', 'info', 'success'];
const themeColors: BannerThemeColor[] = ['primary', 'secondary', 'tertiary', 'accent'];

const meta: Meta = {
  title: 'Information/Banner',
  component: Banner,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove', 'action'] },
  },
  argTypes: {
    variant: { control: { type: 'select' }, options: ['neutral', ...severities] },
    themeColor: { control: { type: 'select' }, options: [undefined, ...themeColors] },
    isProminent: { control: 'boolean' },
  },
};

export const Basic: StoryFn<BannerProps> = (args) => (
  <Banner {...args}>Supporting detail about the message, such as what happened or what to do next.</Banner>
);

Basic.args = {
  title: 'Basic',
  variant: 'neutral',
};

// A neutral banner in a hard-coded palette, through the custom color escape hatch.
const HardCodedBanner = ({ palette }: { palette: (typeof hardCodedPalettes)[number] }) => {
  const theme = useTheme2();
  const { backgroundColor, borderColor, iconColor, textColor } = theme.isDark ? palette.dark : palette.light;

  return (
    <Banner
      title={`Custom colors: ${palette.name}`}
      icon={palette.icon}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      iconColor={iconColor}
      textColor={textColor}
      action={<Button onClick={action('Action button clicked')}>Learn more</Button>}
      onRemove={action('Remove button clicked')}
    >
      A neutral banner in custom colors.
    </Banner>
  );
};

const DismissibleExample = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return <Button onClick={() => setVisible(true)}>Show banner again</Button>;
  }

  return (
    <Banner title="Dismissible banner" icon="bell" onRemove={() => setVisible(false)}>
      Click the X icon to dismiss this banner.
    </Banner>
  );
};

export const Examples: StoryFn<BannerProps> = () => (
  <Stack direction="column">
    <StoryExample name="Severities">
      <Stack direction="column">
        {severities.map((severity) => (
          <Banner
            title={`Severity: ${severity}`}
            variant={severity}
            action={<Button onClick={action('Action button clicked')}>Learn more</Button>}
            onRemove={action('Remove button clicked')}
            key={severity}
          >
            A status message in the colors of its severity.
          </Banner>
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Prominent">
      <Stack direction="column">
        {severities.map((severity) => (
          <Banner
            title={`Prominent: ${severity}`}
            variant={severity}
            isProminent
            action={
              <LinkButton href="https://grafana.com" target="_blank">
                View details
              </LinkButton>
            }
            onRemove={action('Remove button clicked')}
            key={severity}
          >
            The single most important message on a page.
          </Banner>
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Neutral theme colors">
      <Stack direction="column">
        {themeColors.map((themeColor) => (
          <Banner
            title={`Theme color: ${themeColor}`}
            themeColor={themeColor}
            icon="rocket"
            action={<Button onClick={action('Action button clicked')}>Try it</Button>}
            buttonContent="Not now"
            onRemove={action('Dismiss button clicked')}
            key={themeColor}
          >
            Supporting detail about the new feature, such as what it does and where to find it.
          </Banner>
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Custom colors (light and dark palettes)">
      <Stack direction="column">
        {hardCodedPalettes.map((palette) => (
          <HardCodedBanner palette={palette} key={palette.name} />
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Dismissible with X icon">
      <DismissibleExample />
    </StoryExample>
    <StoryExample name="Loading">
      <Banner title="Preparing your trial" themeColor="tertiary" isLoading onRemove={action('Remove button clicked')}>
        The spinner replaces the icon while something loads. The banner can still be dismissed.
      </Banner>
    </StoryExample>
    <StoryExample name="Compact">
      <Stack direction="column">
        {severities.map((severity) => (
          <Banner
            title={`Compact: ${severity}`}
            variant={severity}
            isCompact
            buttonContent="Dismiss"
            onRemove={action('Dismiss button clicked')}
            key={severity}
          />
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="No icon">
      <Banner title="A banner without an icon" themeColor="secondary">
        Without an icon, the banner shows no icon tile.
      </Banner>
    </StoryExample>
  </Stack>
);

export default meta;
