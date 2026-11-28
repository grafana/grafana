import { type StoryFn, type Meta } from '@storybook/react';
import { useState } from 'react';
import { action } from 'storybook/actions';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { type HardCodedColors, hardCodedPalettes } from '../../utils/storybook/hardCodedPalettes';
import { BannerActionButton } from '../BannerActionButton/BannerActionButton';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { Banner, type BannerProps } from './Banner';
import mdx from './Banner.mdx';
import { getOpaqueBackgroundColor } from './Banner.styles';

type ExplicitColorProps =
  | 'role'
  | 'icon'
  | 'backgroundColor'
  | 'borderColor'
  | 'iconColor'
  | 'textColor'
  | 'dismissButtonBackgroundColor'
  | 'dismissButtonTextColor';

type ThemeColor = 'primary' | 'secondary' | 'tertiary' | 'accent';

type ThemeColorBannerProps = Omit<BannerProps, ExplicitColorProps> & {
  themeColor: ThemeColor;
  icon?: IconName;
  role?: BannerProps['role'];
};

// Derives Banner's explicit color props from a color in the active theme.
const ThemeColorBanner = ({ themeColor, ...props }: ThemeColorBannerProps) => {
  const theme = useTheme2();
  const color = theme.colors[themeColor];
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const backgroundColor = visualRefreshEnabled ? color.subtleBackground : color.transparent;

  return (
    <Banner
      backgroundColor={backgroundColor}
      borderColor={visualRefreshEnabled ? color.subtleBorder : color.borderTransparent}
      iconColor={color.text}
      textColor={visualRefreshEnabled ? color.textEmphasis : theme.colors.text.primary}
      dismissButtonBackgroundColor={color.text}
      dismissButtonTextColor={visualRefreshEnabled ? backgroundColor : getOpaqueBackgroundColor(theme, backgroundColor)}
      {...props}
    />
  );
};

const otherThemeColors: Array<{ themeColor: ThemeColor; icon: IconName }> = [
  { themeColor: 'primary', icon: 'rocket' },
  { themeColor: 'secondary', icon: 'bell' },
  { themeColor: 'tertiary', icon: 'star' },
  { themeColor: 'accent', icon: 'ai-sparkle' },
];

const HardCodedBanner = ({
  palette,
  ...props
}: Omit<BannerProps, keyof HardCodedColors | 'role' | 'icon'> & { palette: (typeof hardCodedPalettes)[number] }) => {
  const theme = useTheme2();

  return <Banner icon={palette.icon} {...(theme.isDark ? palette.dark : palette.light)} {...props} />;
};

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
    themeColor: {
      control: { type: 'select', options: otherThemeColors.map(({ themeColor }) => themeColor) },
    },
  },
};

export const Basic: StoryFn<ThemeColorBannerProps> = (args) => {
  return (
    <div>
      <ThemeColorBanner {...args}>
        Supporting detail about the new feature, such as what it does and where to find it.
      </ThemeColorBanner>
    </div>
  );
};

Basic.args = {
  themeColor: 'primary',
  icon: 'rocket',
  title: 'Basic',
};

const DismissibleExample = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return <Button onClick={() => setVisible(true)}>Show banner again</Button>;
  }

  return (
    <ThemeColorBanner title="Dismissible banner" themeColor="secondary" icon="bell" onRemove={() => setVisible(false)}>
      Click the X icon to dismiss this banner.
    </ThemeColorBanner>
  );
};

// Example actions in the banner's colors: a BannerActionButton in the banner's icon color.
const ThemeColorAction = ({ themeColor }: { themeColor: ThemeColor }) => {
  const theme = useTheme2();

  return (
    <BannerActionButton customColor={theme.colors[themeColor].text} onClick={action('Action button clicked')}>
      Learn more
    </BannerActionButton>
  );
};

const HardCodedAction = ({ palette }: { palette: (typeof hardCodedPalettes)[number] }) => {
  const theme = useTheme2();

  return (
    <BannerActionButton
      customColor={(theme.isDark ? palette.dark : palette.light).iconColor}
      onClick={action('Action button clicked')}
    >
      Learn more
    </BannerActionButton>
  );
};

export const Examples: StoryFn<ThemeColorBannerProps> = () => {
  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        <ThemeColorBanner
          title={'The title of the banner'}
          themeColor="primary"
          icon="rocket"
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Supporting detail about the new feature, such as what it does and where to find it.
        </ThemeColorBanner>
      </StoryExample>
      <StoryExample name="Dismissible with X icon">
        <DismissibleExample />
      </StoryExample>
      <StoryExample name="Loading">
        <ThemeColorBanner title="Preparing your trial" themeColor="tertiary" icon="star" isLoading>
          The spinner replaces the icon while something loads.
        </ThemeColorBanner>
      </StoryExample>
      <StoryExample name="Single line with X icon">
        <ThemeColorBanner
          title="A single line of text with a dismiss icon"
          themeColor="accent"
          icon="ai-sparkle"
          onRemove={action('Remove button clicked')}
        />
      </StoryExample>
      <StoryExample name="No dismiss">
        <ThemeColorBanner title={'No dismiss'} themeColor="secondary" icon="bell" />
      </StoryExample>
      <StoryExample name="No icon">
        <ThemeColorBanner title="A banner without an icon" themeColor="primary">
          Without an icon, the banner shows no icon tile.
        </ThemeColorBanner>
      </StoryExample>
      <StoryExample name="Compact">
        <Stack direction="column">
          {otherThemeColors.map(({ themeColor, icon }) => (
            <ThemeColorBanner
              title={`Compact: ${themeColor}`}
              themeColor={themeColor}
              icon={icon}
              isCompact
              buttonContent="Dismiss"
              onRemove={action('Dismiss button clicked')}
              key={themeColor}
            />
          ))}
        </Stack>
      </StoryExample>
      <StoryExample name="Other theme colors">
        <Stack direction="column">
          {otherThemeColors.map(({ themeColor, icon }) => (
            <ThemeColorBanner
              title={`Theme color: ${themeColor}`}
              themeColor={themeColor}
              icon={icon}
              action={<ThemeColorAction themeColor={themeColor} />}
              buttonContent="Dismiss"
              onRemove={action('Dismiss button clicked')}
              key={themeColor}
            >
              Child content
            </ThemeColorBanner>
          ))}
        </Stack>
      </StoryExample>
      <StoryExample name="Hard-coded colors (light and dark palettes)">
        <Stack direction="column">
          {hardCodedPalettes.map((palette) => (
            <HardCodedBanner
              title={`Hard-coded: ${palette.name}`}
              palette={palette}
              action={<HardCodedAction palette={palette} />}
              buttonContent="Dismiss"
              onRemove={action('Dismiss button clicked')}
              key={palette.name}
            >
              Child content
            </HardCodedBanner>
          ))}
        </Stack>
      </StoryExample>
    </Stack>
  );
};

export default meta;
