import React from 'react';
import { FeatureState } from '@grafana/data';
import { InfoBox, FeatureInfoBox } from '@grafana/ui';
import mdx from './InfoBox.mdx';
import {
  DismissableFeatureInfoBox,
  DismissableFeatureInfoBoxProps,
  FEATUREINFOBOX_PERSISTENCE_ID_PREFIX,
} from './DismissableFeatureInfoBox';
import { Button } from '../Button';
import { css } from 'emotion';
import { Story } from '@storybook/react';
import { FeatureInfoBoxProps } from './FeatureInfoBox';
import { InfoBoxProps } from './InfoBox';

export default {
  title: 'Layout/InfoBox',
  component: InfoBox,
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    onDismiss: { action: 'Dismissed' },
    featureState: {
      control: { type: 'select', options: ['alpha', 'beta', undefined] },
    },
    children: {
      table: {
        disable: true,
      },
    },
  },
};

const defaultProps: DismissableFeatureInfoBoxProps = {
  title: 'A title',
  severity: 'info',
  url: 'http://www.grafana.com',
  persistenceId: 'storybook-feature-info-box-persist',
  featureState: FeatureState.beta,

  children: (
    <p>
      The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
      query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
      statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect against
      this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted permissions.
    </p>
  ),
};

const InfoBoxTemplate: Story<InfoBoxProps> = (args) => <InfoBox {...args} />;
export const infoBox = InfoBoxTemplate.bind({});
infoBox.args = defaultProps;

const FeatureInfoBoxTemplate: Story<FeatureInfoBoxProps> = (args) => <FeatureInfoBox {...args}></FeatureInfoBox>;
export const featureInfoBox = FeatureInfoBoxTemplate.bind({});
featureInfoBox.args = defaultProps;

const DismissableTemplate: Story<DismissableFeatureInfoBoxProps> = (args) => {
  const onResetClick = () => {
    localStorage.removeItem(FEATUREINFOBOX_PERSISTENCE_ID_PREFIX.concat(args.persistenceId));
    location.reload();
  };

  return (
    <div>
      <div>
        <DismissableFeatureInfoBox {...args} />
      </div>
      <div
        className={css`
          margin-top: 24px;
        `}
      >
        <Button onClick={onResetClick}>Reset DismissableFeatureInfoBox</Button>
      </div>
    </div>
  );
};
export const dismissableFeatureInfoBox = DismissableTemplate.bind({});
dismissableFeatureInfoBox.args = defaultProps;
