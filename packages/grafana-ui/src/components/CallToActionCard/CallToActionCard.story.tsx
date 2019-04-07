import React from 'react';
import { storiesOf } from '@storybook/react';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { CallToActionCard } from './CallToActionCard';
import { select, text } from '@storybook/addon-knobs';
import { LargeButton } from '../Button/Button';
import { action } from '@storybook/addon-actions';

const CallToActionCardStories = storiesOf('UI/CallToActionCard', module);

CallToActionCardStories.add('default', () => {
  const ctaElements: { [key: string]: JSX.Element } = {
    custom: <h1>This is just H1 tag, you can any component as CTA element</h1>,
    button: (
      <LargeButton icon="fa fa-plus" onClick={action('cta button clicked')}>
        Add datasource
      </LargeButton>
    ),
  };
  const ctaElement = select(
    'Call to action element',
    {
      Custom: 'custom',
      Button: 'button',
    },
    'custom'
  );

  return renderComponentWithTheme(CallToActionCard, {
    message: text('Call to action message', 'Renders message prop content'),
    callToActionElement: ctaElements[ctaElement],
    footer: text('Call to action footer', 'Renders footer prop content'),
  });
});
