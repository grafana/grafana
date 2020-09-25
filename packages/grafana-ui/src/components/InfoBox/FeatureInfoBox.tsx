import React from 'react';
import { InfoBox, InfoBoxProps } from './InfoBox';
import { FeatureState, GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { Badge, BadgeProps } from '../Badge/Badge';
import { css } from 'emotion';

interface FeatureInfoBoxProps extends Omit<InfoBoxProps, 'branded' | 'title' | 'urlTitle'> {
  title: string;
  featureState?: FeatureState;
}

export const FeatureInfoBox = React.memo(
  React.forwardRef<HTMLDivElement, FeatureInfoBoxProps>(({ title, featureState, ...otherProps }, ref) => {
    const theme = useTheme();
    const styles = getFeatureInfoBoxStyles(theme);

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
    return <InfoBox branded title={titleEl} urlTitle="Read documentation" {...otherProps} />;
  })
);

const getFeatureInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    badge: css`
      margin-bottom: ${theme.spacing.sm};
    `,
  };
});

interface FeatureBadgeProps {
  featureState: FeatureState;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({ featureState }) => {
  const display = getPanelStateBadgeDisplayModel(featureState);
  return <Badge text={display.text} color={display.color} icon={display.icon} />;
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
