import React from 'react';
import { storiesOf } from '@storybook/react';

import { Legend } from './Legend';
import { Label } from './Label';

const story = storiesOf('UI/Forms/Test', module);

story.add('Configuration/Preferences', () => {
  return (
    <div>
      <fieldset>
        <Legend>Organization profile</Legend>
        <Label description="Provide a name of your organisation that will be used across Grafana installation">
          Organization name
        </Label>
      </fieldset>
    </div>
  );
});
