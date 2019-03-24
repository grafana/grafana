import { configure, addDecorator } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import { withTheme } from '../src/utils/storybook/withTheme';

// @ts-ignore
import lightTheme from '../../../public/sass/grafana.light.scss';
// @ts-ignore
import darkTheme from '../../../public/sass/grafana.dark.scss';

const handleThemeChange = (theme: string) => {
  if (theme !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};
// automatically import all files ending in *.stories.tsx
const req = require.context('../src/components', true, /.story.tsx$/);

addDecorator(withKnobs);
addDecorator(withTheme(handleThemeChange));

function loadStories() {
  req.keys().forEach(req);
}

configure(loadStories, module);
