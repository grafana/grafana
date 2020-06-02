const stories = ['../src/**/*.story.@{js,jsx,ts,tsx,mdx}'];

if (process.env.NODE_ENV !== 'production') {
  stories.push('../src/**/*.story.internal.@{js,jsx,ts,tsx,mdx}');
}

module.exports = {
  stories: stories,
  addons: [
    '@storybook/addon-knobs/register',
    '@storybook/addon-actions/preset',
    '@storybook/addon-docs',
    'storybook-dark-mode/register',
    '@storybook/addon-storysource',
  ],
};
