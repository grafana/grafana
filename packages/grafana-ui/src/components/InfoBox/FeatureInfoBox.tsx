import { css } from '@emotion/css';
import { memo, forwardRef } from 'react';

import { FeatureState, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { FeatureBadge } from '../FeatureBadge/FeatureBadge';

import { InfoBox, InfoBoxProps } from './InfoBox';

export interface FeatureInfoBoxProps extends Omit<InfoBoxProps, 'title' | 'urlTitle'> {
  title: string;
  featureState?: FeatureState;
}

/** @deprecated use Alert with severity info */
export const FeatureInfoBox = memo(
  forwardRef<HTMLDivElement, FeatureInfoBoxProps>(({ title, featureState, ...otherProps }, ref) => {
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
    badge: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
