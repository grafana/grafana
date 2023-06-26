import { css } from '@emotion/css';
import React from 'react';

import { FeatureState, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Badge, BadgeProps } from '../Badge/Badge';

import { InfoBox, InfoBoxProps } from './InfoBox';

export interface FeatureInfoBoxProps extends Omit<InfoBoxProps, 'title' | 'urlTitle'> {
  title: string;
  featureState?: FeatureState;
}

/** @deprecated use Alert with severity info */
export const FeatureInfoBox = React.memo(
  React.forwardRef<HTMLDivElement, FeatureInfoBoxProps>(({ title, featureState, ...otherProps }, ref) => {
    const styles = useStyles2(getFeatureInfoBoxStyles);

    const titleEl = featureState ? (
      <>
        <div className={styles.badge}>
          <FeatureBadge featureState={featureState} />
        </div>
        <h3>{title}</h3>
      </>
    ) : (
      <h3>{title}</h3>
    );
    return <InfoBox branded title={titleEl} urlTitle="Read documentation" ref={ref} {...otherProps} />;
  })
);

FeatureInfoBox.displayName = 'FeatureInfoBox';

const getFeatureInfoBoxStyles = (theme: GrafanaTheme2) => {
  return {
    badge: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};

interface FeatureBadgeProps {
  featureState: FeatureState;
  tooltip?: string;
}

export const FeatureBadge = ({ featureState, tooltip }: FeatureBadgeProps) => {
  const display = getPanelStateBadgeDisplayModel(featureState);
  return <Badge text={display.text} color={display.color} icon={display.icon} tooltip={tooltip} />;
};

function getPanelStateBadgeDisplayModel(featureState: FeatureState): BadgeProps {
  switch (featureState) {
    case FeatureState.alpha:
      return {
        text: 'Alpha',
        icon: 'exclamation-triangle',
        color: 'orange',
      };
  }

  return {
    text: 'Beta',
    icon: 'rocket',
    color: 'blue',
  };
}
