import React from 'react';
import { storiesOf } from '@storybook/react';
import { DeleteButton } from '@grafana/ui';

storiesOf('Test story', module)
.addDecorator((story) => (
  <div style={{padding: '20px'}}>{story()}</div>
))
  .add('with text', () => {
  return <DeleteButton onConfirm={() => { }}></DeleteButton>;
});
