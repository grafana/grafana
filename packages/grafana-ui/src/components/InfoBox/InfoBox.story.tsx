import React from 'react';
import { number } from '@storybook/addon-knobs';
import { InfoBox, FeatureInfoBox } from '@grafana/ui';
import { FeatureState } from '@grafana/data';

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
        title="User Permission"
        url={'http://docs.grafana.org/features/datasources/mysql/'}
        onDismiss={() => {
          alert('onDismiss clicked');
        }}
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

export const featureInfoBox = () => {
  const { containerWidth } = getKnobs();

  return (
    <div style={{ width: containerWidth }}>
      <FeatureInfoBox
        title="Transformations"
        url={'http://www.grafana.com'}
        featureState={FeatureState.beta}
        onDismiss={() => {
          alert('onDismiss clicked');
        }}
      >
        Transformations allow you to join, calculate, re-order, hide and rename your query results before being
        visualized. <br />
        Many transforms are not suitable if you're using the Graph visualisation as it currently only supports time
        series. <br />
        It can help to switch to Table visualisation to understand what a transformation is doing.
      </FeatureInfoBox>
    </div>
  );
};
