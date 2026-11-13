import { type StoryFn, type Meta } from '@storybook/react';
import { useState } from 'react';
import { action } from 'storybook/actions';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { Banner, type BannerProps } from './Banner';

type Severity = 'error' | 'warning' | 'info' | 'success';

const severities: Severity[] = ['error', 'warning', 'info', 'success'];

const iconsBySeverity: Record<Severity, IconName> = {
  error: 'exclamation-circle',
  warning: 'exclamation-triangle',
  info: 'info-circle',
  success: 'check',
};

const rolesBySeverity: Record<Severity, BannerProps['role']> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
};

type ExplicitColorProps = 'role' | 'icon' | 'backgroundColor' | 'borderColor' | 'iconColor' | 'textColor';

type ThemeColor = 'primary' | 'secondary' | 'tertiary' | 'accent' | Severity;

type ThemeColorBannerProps = Omit<BannerProps, ExplicitColorProps> & {
  themeColor: ThemeColor;
  icon: IconName;
  role: BannerProps['role'];
};

// Derives Banner's explicit color props from a color in the active theme.
const ThemeColorBanner = ({ themeColor, ...props }: ThemeColorBannerProps) => {
  const theme = useTheme2();
  const color = theme.colors[themeColor];
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  return (
    <Banner
      backgroundColor={visualRefreshEnabled ? color.subtleBackground : color.transparent}
      borderColor={visualRefreshEnabled ? color.subtleBorder : color.borderTransparent}
      iconColor={color.text}
      textColor={visualRefreshEnabled ? color.textEmphasis : theme.colors.text.primary}
      {...props}
    />
  );
};

type SeverityBannerProps = Omit<BannerProps, ExplicitColorProps> & {
  severity: Severity;
};

const SeverityBanner = ({ severity, ...props }: SeverityBannerProps) => (
  <ThemeColorBanner
    themeColor={severity}
    role={rolesBySeverity[severity]}
    icon={iconsBySeverity[severity]}
    {...props}
  />
);

const otherThemeColors: Array<{ themeColor: ThemeColor; icon: IconName }> = [
  { themeColor: 'primary', icon: 'rocket' },
  { themeColor: 'secondary', icon: 'bell' },
  { themeColor: 'tertiary', icon: 'star' },
  { themeColor: 'accent', icon: 'ai-sparkle' },
];

type HardCodedColors = Pick<BannerProps, 'backgroundColor' | 'borderColor' | 'iconColor' | 'textColor'>;

// Example hardcoded values, with a Tailwind-inspired palette. Light mode uses
// the 100 fill, 300 edge, 700 icon and 800 text steps; dark mode uses 950, 800,
// 300 and 200.
const hardCodedPalettes: Array<{ name: string; icon: IconName; light: HardCodedColors; dark: HardCodedColors }> = [
  {
    name: 'violet',
    icon: 'lightbulb-alt',
    light: {
      backgroundColor: 'oklch(94.3% 0.0284 294.59)',
      borderColor: 'oklch(81.1% 0.0874 293.57)',
      iconColor: 'oklch(49.1% 0.1174 292.58)',
      textColor: 'oklch(43.2% 0.1151 292.76)',
    },
    dark: {
      backgroundColor: 'oklch(28.3% 0.0991 291.09)',
      borderColor: 'oklch(43.2% 0.1151 292.76)',
      iconColor: 'oklch(81.1% 0.0874 293.57)',
      textColor: 'oklch(89.4% 0.0531 293.28)',
    },
  },
  {
    name: 'teal',
    icon: 'shield',
    light: {
      backgroundColor: 'oklch(95.3% 0.0481 180.8)',
      borderColor: 'oklch(85.5% 0.0981 181.07)',
      iconColor: 'oklch(51.1% 0.0797 186.39)',
      textColor: 'oklch(43.7% 0.0686 188.22)',
    },
    dark: {
      backgroundColor: 'oklch(27.7% 0.0439 192.52)',
      borderColor: 'oklch(43.7% 0.0686 188.22)',
      iconColor: 'oklch(85.5% 0.0981 181.07)',
      textColor: 'oklch(91% 0.0797 180.43)',
    },
  },
  {
    name: 'pink',
    icon: 'heart',
    light: {
      backgroundColor: 'oklch(94.8% 0.0275 342.26)',
      borderColor: 'oklch(82.3% 0.0914 346.02)',
      iconColor: 'oklch(52.5% 0.1143 3.958)',
      textColor: 'oklch(45.9% 0.1098 3.815)',
    },
    dark: {
      backgroundColor: 'oklch(28.4% 0.0864 3.907)',
      borderColor: 'oklch(45.9% 0.1098 3.815)',
      iconColor: 'oklch(82.3% 0.0914 346.02)',
      textColor: 'oklch(89.9% 0.0562 343.23)',
    },
  },
  {
    name: 'lime',
    icon: 'thumbs-up',
    light: {
      backgroundColor: 'oklch(96.7% 0.0608 122.33)',
      borderColor: 'oklch(89.7% 0.1112 126.67)',
      iconColor: 'oklch(53.2% 0.1037 131.59)',
      textColor: 'oklch(45.3% 0.093 130.93)',
    },
    dark: {
      backgroundColor: 'oklch(27.4% 0.0644 132.11)',
      borderColor: 'oklch(45.3% 0.093 130.93)',
      iconColor: 'oklch(89.7% 0.1112 126.67)',
      textColor: 'oklch(93.8% 0.0942 124.32)',
    },
  },
];

const HardCodedBanner = ({
  palette,
  ...props
}: Omit<BannerProps, keyof HardCodedColors | 'role' | 'icon'> & { palette: (typeof hardCodedPalettes)[number] }) => {
  const theme = useTheme2();

  return <Banner role="status" icon={palette.icon} {...(theme.isDark ? palette.dark : palette.light)} {...props} />;
};

const meta: Meta = {
  title: 'Information/Banner',
  component: Banner,
  parameters: {
    controls: { exclude: ['onRemove', 'action'] },
  },
  argTypes: {
    severity: {
      control: { type: 'select', options: severities },
    },
  },
};

export const Basic: StoryFn<SeverityBannerProps> = (args) => {
  return (
    <div>
      <SeverityBanner {...args}>
        Child content that includes some banner details, like maybe what actually happened.
      </SeverityBanner>
    </div>
  );
};

Basic.args = {
  severity: 'error',
  title: 'Basic',
};

const DismissibleExample = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return <Button onClick={() => setVisible(true)}>Show banner again</Button>;
  }

  return (
    <SeverityBanner title="Dismissible banner" severity="info" onRemove={() => setVisible(false)}>
      Click the X icon to dismiss this banner.
    </SeverityBanner>
  );
};

export const Examples: StoryFn<SeverityBannerProps> = () => {
  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        <SeverityBanner
          title={'The title of the banner'}
          severity={'error'}
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Child content that includes some banner details, like maybe what actually happened
        </SeverityBanner>
      </StoryExample>
      <StoryExample name="Dismissible with X icon">
        <DismissibleExample />
      </StoryExample>
      <StoryExample name="Loading">
        <SeverityBanner title="Loading data" severity="info" isLoading>
          The spinner replaces the icon while something loads.
        </SeverityBanner>
      </StoryExample>
      <StoryExample name="Single line with X icon">
        <SeverityBanner
          title="A single line of text with a dismiss icon"
          severity="warning"
          onRemove={action('Remove button clicked')}
        />
      </StoryExample>
      <StoryExample name="No dismiss">
        <SeverityBanner title={'No dismiss'} severity={'success'} />
      </StoryExample>
      <StoryExample name="Severities">
        <Stack direction="column">
          {severities.map((severity) => (
            <SeverityBanner title={`Severity: ${severity}`} severity={severity} key={severity}>
              Child content
            </SeverityBanner>
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
              role="status"
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
            <HardCodedBanner title={`Hard-coded: ${palette.name}`} palette={palette} key={palette.name}>
              Child content
            </HardCodedBanner>
          ))}
        </Stack>
      </StoryExample>
    </Stack>
  );
};

export default meta;
