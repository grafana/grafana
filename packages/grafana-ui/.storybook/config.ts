import { configure, addDecorator } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import { withTheme } from '../src/utils/storybook/withTheme';

import '../../../public/sass/grafana.light.scss';

// automatically import all files ending in *.stories.tsx
const req = require.context('../src/components', true, /.story.tsx$/);

addDecorator(withKnobs);
addDecorator(withTheme);

function loadStories() {
  req.keys().forEach(req);
}

configure(loadStories, module);
