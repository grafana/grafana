import { t } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { type SolutionLearnMore } from './types';

interface LearnMoreLinkProps extends SolutionLearnMore {
  onClick?: () => void;
}

export function LearnMoreLink({
  href,
  label = t('home.learn-more', 'Learn more'),
  external = true,
  onClick,
}: LearnMoreLinkProps) {
  return (
    <TextLink variant="bodySmall" external={external} href={href} onClick={onClick}>
      {label}
    </TextLink>
  );
}
