import { configure } from '@storybook/react';

import '@grafana/ui/src/components/index.scss';

// automatically import all files ending in *.stories.tsx
const req = require.context('../src/components', true, /.story.tsx$/);

function loadStories() {
  req.keys().forEach(req);
}

configure(loadStories, module);
