module.exports = {
  stories: ['../src/**/*.story.{js,jsx,ts,tsx,mdx}'],
  addons: [
    '@storybook/addon-knobs',
    '@storybook/addon-actions',
    '@storybook/addon-docs',
    'storybook-dark-mode/register',
    '@storybook/addon-storysource',
  ],
};
