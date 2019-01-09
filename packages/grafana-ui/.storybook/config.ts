import { configure } from '@storybook/react';
import '../../../public/sass/grafana.dark.scss';

// automatically import all files ending in *.stories.tsx
const req = require.context('../stories', true, /.story.tsx$/);

function loadStories() {
  req.keys().forEach(req);
}

configure(loadStories, module);
