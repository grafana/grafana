import { css } from '@emotion/css';
import { type Meta, type StoryFn } from '@storybook/react';
import { type ReactNode } from 'react';
import { action } from 'storybook/actions';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { hardCodedPalettes } from '../../utils/storybook/hardCodedPalettes';
import { type BannerSeverity } from '../Banner/types';
import { Stack } from '../Layout/Stack/Stack';

import { BannerActionButton } from './BannerActionButton';
import mdx from './BannerActionButton.mdx';

const severities: BannerSeverity[] = ['error', 'warning', 'info', 'success'];

const meta: Meta<typeof BannerActionButton> = {
  title: 'Inputs/BannerActionButton',
  component: BannerActionButton,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    severity: { control: 'select', options: [undefined, ...severities] },
    customColor: { control: 'color' },
  },
};

export const Basic: StoryFn<typeof BannerActionButton> = (args) => <BannerActionButton {...args} />;

Basic.args = {
  children: 'Request increase',
  severity: 'warning',
  onClick: action('Action button clicked'),
};

const getBackgroundStyles = (theme: GrafanaTheme2, backgroundColor: string) =>
  css({
    display: 'inline-flex',
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.lg,
    backgroundColor,
  });

// Shows a button on a banner-like background, as it would appear inside a banner.
const OnBackground = ({ backgroundColor, children }: { backgroundColor: string; children: ReactNode }) => {
  const className = useStyles2(getBackgroundStyles, backgroundColor);

  return <div className={className}>{children}</div>;
};

// As a prominent banner uses it: the banner's text color on the banner's background.
const ProminentExample = ({ severity }: { severity: BannerSeverity }) => {
  const theme = useTheme2();
  const { background, text } = theme.components.banner.prominent[severity];

  return (
    <OnBackground backgroundColor={background}>
      <BannerActionButton customColor={text} onClick={action('Action button clicked')}>
        Request increase
      </BannerActionButton>
    </OnBackground>
  );
};

// Uses the hard-coded palettes from the Banner examples: the icon color as the button color, on the banner's fill.
const CustomColorExample = ({ palette }: { palette: (typeof hardCodedPalettes)[number] }) => {
  const theme = useTheme2();
  const colors = theme.isDark ? palette.dark : palette.light;

  return (
    <OnBackground backgroundColor={colors.backgroundColor}>
      <BannerActionButton customColor={colors.iconColor} onClick={action('Action button clicked')}>
        {`Custom: ${palette.name}`}
      </BannerActionButton>
    </OnBackground>
  );
};

export const Examples: StoryFn<typeof BannerActionButton> = () => (
  <Stack direction="column" gap={3}>
    <StoryExample name="Severities">
      <Stack>
        {severities.map((severity) => (
          <BannerActionButton severity={severity} onClick={action('Action button clicked')} key={severity}>
            {`Severity: ${severity}`}
          </BannerActionButton>
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Custom colors, on the hard-coded Banner palettes">
      <Stack>
        {hardCodedPalettes.map((palette) => (
          <CustomColorExample palette={palette} key={palette.name} />
        ))}
      </Stack>
    </StoryExample>
    <StoryExample name="Prominent banner colors, on their backgrounds">
      <Stack>
        {severities.map((severity) => (
          <ProminentExample severity={severity} key={severity} />
        ))}
      </Stack>
    </StoryExample>
  </Stack>
);

export default meta;
