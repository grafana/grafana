import { t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

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
    <LinkButton
      variant="secondary"
      size="sm"
      fill="text"
      icon={external ? 'external-link-alt' : undefined}
      iconPlacement="right"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      onClick={onClick}
    >
      {label}
    </LinkButton>
  );
}
