import { configure } from '@storybook/react';

import '../../../public/sass/grafana.light.scss';

// automatically import all files ending in *.stories.tsx
const req = require.context('../src/components', true, /.story.tsx$/);

function loadStories() {
  req.keys().forEach(req);
}

configure(loadStories, module);
