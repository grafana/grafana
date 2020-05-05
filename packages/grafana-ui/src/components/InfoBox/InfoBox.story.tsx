import React from 'react';
import { number } from '@storybook/addon-knobs';
import { InfoBox } from './InfoBox';

export default {
  title: 'Layout/InfoBox',
  component: InfoBox,
  decorators: [],
  parameters: {
    docs: {},
  },
};

const getKnobs = () => {
  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerWidth = number(
    'Container width',
    800,
    {
      range: true,
      min: 100,
      max: 1500,
      step: 100,
    },
    CONTAINER_GROUP
  );

  return { containerWidth };
};

export const basic = () => {
  const { containerWidth } = getKnobs();

  return (
    <div style={{ width: containerWidth }}>
      <InfoBox
        header="User Permission"
        footer={
          <>
            Checkout the{' '}
            <a className="external-link" target="_blank" href="http://docs.grafana.org/features/datasources/mysql/">
              MySQL Data Source Docs
            </a>{' '}
            for more information.,
          </>
        }
      >
        <p>
          The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
          query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
          statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect
          against this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted
          permissions.
        </p>
      </InfoBox>
    </div>
  );
};
