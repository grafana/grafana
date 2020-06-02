const stories = ['../src/**/*.story.{js,jsx,ts,tsx,mdx}'];

if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.story.internal.{js,jsx,ts,tsx,mdx}');
}

module.exports = {
  stories: stories,
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-actions/register',
    '@storybook/addon-knobs',
    'storybook-dark-mode/register',
    '@storybook/addon-storysource',
  ],
};
