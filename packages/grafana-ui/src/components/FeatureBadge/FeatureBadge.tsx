import { FeatureState } from '@grafana/data';
import { TFunction } from '@grafana/i18n';

import { useTranslate } from '../../utils/i18n';
import { Badge, BadgeProps } from '../Badge/Badge';

export interface FeatureBadgeProps {
  featureState: FeatureState;
  tooltip?: string;
}

export const FeatureBadge = ({ featureState, tooltip }: FeatureBadgeProps) => {
  const { t } = useTranslate();
  const display = getPanelStateBadgeDisplayModel(featureState, t);
  return <Badge text={display.text} color={display.color} icon={display.icon} tooltip={tooltip} />;
};

function getPanelStateBadgeDisplayModel(featureState: FeatureState, t: TFunction): BadgeProps {
  switch (featureState) {
    case FeatureState.alpha:
      return {
        text: 'Alpha',
        icon: 'exclamation-triangle',
        color: 'orange',
      };

    case FeatureState.beta:
      return {
        text: 'Beta',
        icon: 'rocket',
        color: 'blue',
      };

    case FeatureState.experimental:
      return {
        text: t('grafana-ui.feature-badge.experimental', 'Experimental'),
        icon: 'exclamation-triangle',
        color: 'orange',
      };

    case FeatureState.preview:
      return {
        text: t('grafana-ui.feature-badge.preview', 'Preview'),
        icon: 'rocket',
        color: 'blue',
      };

    case FeatureState.privatePreview:
      return {
        text: t('grafana-ui.feature-badge.private-preview', 'Private preview'),
        icon: 'rocket',
        color: 'blue',
      };

    case FeatureState.new:
      return {
        text: t('grafana-ui.feature-badge.new', 'New!'),
        icon: 'rocket',
        color: 'blue',
      };
  }
}
