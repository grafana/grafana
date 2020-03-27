export const docsTpl = `import { Story, Preview, Props } from '@storybook/addon-docs/blocks';
import { <%= name %> } from './<%= name %>';

# <%= name %>

### Usage

\`\`\`jsx
import { <%= name %> } from '@grafana/ui';

<<%= name %> />
\`\`\`

### Props
<Props of={<%= name %>} />
`;
