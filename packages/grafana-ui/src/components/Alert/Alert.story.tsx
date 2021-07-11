import React from 'react';
import { Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';
import { Props } from './Alert';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { renderMarkdown } from '../../../../grafana-data/src';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

export default {
  title: 'Overlays/Alert',
  component: Alert,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
    controls: {
      exclude: ['onRemove'],
    },
  },
  argTypes: {
    severity: { control: { type: 'select', options: severities } },
  },
};

export const Examples: Story<Props> = ({ severity, title, buttonContent }) => {
  return (
    <VerticalGroup>
      <StoryExample name="With buttonContent and children">
        <Alert
          title={title}
          severity={severity}
          buttonContent={<span>{buttonContent}</span>}
          onRemove={action('Remove button clicked')}
        >
          <VerticalGroup>
            <div>Child content that includes some alert details, like maybe what actually happened.</div>
          </VerticalGroup>
        </Alert>
      </StoryExample>
      <StoryExample name="No dismiss">
        <Alert title={title} severity={severity} />
      </StoryExample>
      <StoryExample name="Elevated alert used for absolute positioned alerts">
        <Alert title={title} severity={severity} elevated />
      </StoryExample>
      <StoryExample name="Severities">
        <VerticalGroup>
          {severities.map((severity) => (
            <Alert
              title={`Severity: ${severity}`}
              severity={severity}
              key={severity}
              onRemove={action('Remove button clicked')}
            />
          ))}
        </VerticalGroup>
      </StoryExample>
    </VerticalGroup>
  );
};

export const LargeContent: Story<Props> = ({}) => {
  const markdown = `# Examples  

  With this transform you can for example transform 

  Name    | Value | Max 
  --------|-------|------
  ServerA | 10    | 100
  ServerB | 20    | 200

  Into. 
  
  ServerA (max=100) | ServerB (max=200)
  ------------------|------------------
  10                | 20   
  
  # More examples

  ServerA (max=100) | ServerB (max=200)
  ------------------|------------------
  10                | 20   
  `;

  const html = renderMarkdown(markdown);

  return (
    <StoryExample name="With large content">
      <Alert title={'Transformation help'} severity={'info'} onRemove={action('Remove button clicked')}>
        <div className="markdown-html" dangerouslySetInnerHTML={{ __html: html }} />;
      </Alert>
    </StoryExample>
  );
};

Examples.args = {
  severity: 'error',
  title: 'Some very important message',
  buttonContent: 'Close',
};
