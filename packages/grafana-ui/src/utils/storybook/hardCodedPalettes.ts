import { type IconName } from '../../types/icon';

/** The explicit colors of a Banner, for one theme mode. */
export interface HardCodedColors {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  dismissButtonBackgroundColor: string;
  dismissButtonTextColor: string;
}

// Example hardcoded values, with a Tailwind-inspired palette. Light mode uses
// the 100 fill, 300 edge, 700 icon and 800 text steps; dark mode uses 950, 800,
// 300 and 200. The dismiss button takes the icon step as its fill and the fill
// step as its text.
export const hardCodedPalettes: Array<{ name: string; icon: IconName; light: HardCodedColors; dark: HardCodedColors }> =
  [
    {
      name: 'violet',
      icon: 'lightbulb-alt',
      light: {
        backgroundColor: 'oklch(94.3% 0.0284 294.59)',
        borderColor: 'oklch(81.1% 0.0874 293.57)',
        iconColor: 'oklch(49.1% 0.1174 292.58)',
        textColor: 'oklch(43.2% 0.1151 292.76)',
        dismissButtonBackgroundColor: 'oklch(49.1% 0.1174 292.58)',
        dismissButtonTextColor: 'oklch(94.3% 0.0284 294.59)',
      },
      dark: {
        backgroundColor: 'oklch(28.3% 0.0991 291.09)',
        borderColor: 'oklch(43.2% 0.1151 292.76)',
        iconColor: 'oklch(81.1% 0.0874 293.57)',
        textColor: 'oklch(89.4% 0.0531 293.28)',
        dismissButtonBackgroundColor: 'oklch(81.1% 0.0874 293.57)',
        dismissButtonTextColor: 'oklch(28.3% 0.0991 291.09)',
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
        dismissButtonBackgroundColor: 'oklch(51.1% 0.0797 186.39)',
        dismissButtonTextColor: 'oklch(95.3% 0.0481 180.8)',
      },
      dark: {
        backgroundColor: 'oklch(27.7% 0.0439 192.52)',
        borderColor: 'oklch(43.7% 0.0686 188.22)',
        iconColor: 'oklch(85.5% 0.0981 181.07)',
        textColor: 'oklch(91% 0.0797 180.43)',
        dismissButtonBackgroundColor: 'oklch(85.5% 0.0981 181.07)',
        dismissButtonTextColor: 'oklch(27.7% 0.0439 192.52)',
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
        dismissButtonBackgroundColor: 'oklch(52.5% 0.1143 3.958)',
        dismissButtonTextColor: 'oklch(94.8% 0.0275 342.26)',
      },
      dark: {
        backgroundColor: 'oklch(28.4% 0.0864 3.907)',
        borderColor: 'oklch(45.9% 0.1098 3.815)',
        iconColor: 'oklch(82.3% 0.0914 346.02)',
        textColor: 'oklch(89.9% 0.0562 343.23)',
        dismissButtonBackgroundColor: 'oklch(82.3% 0.0914 346.02)',
        dismissButtonTextColor: 'oklch(28.4% 0.0864 3.907)',
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
        dismissButtonBackgroundColor: 'oklch(53.2% 0.1037 131.59)',
        dismissButtonTextColor: 'oklch(96.7% 0.0608 122.33)',
      },
      dark: {
        backgroundColor: 'oklch(27.4% 0.0644 132.11)',
        borderColor: 'oklch(45.3% 0.093 130.93)',
        iconColor: 'oklch(89.7% 0.1112 126.67)',
        textColor: 'oklch(93.8% 0.0942 124.32)',
        dismissButtonBackgroundColor: 'oklch(89.7% 0.1112 126.67)',
        dismissButtonTextColor: 'oklch(27.4% 0.0644 132.11)',
      },
    },
  ];
