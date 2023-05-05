import React from 'react';

import { LinkButton } from '@grafana/ui';

type Props = {
  hrefSuffix: string;
};

export function DocsLinkButton(props: Props) {
  const { hrefSuffix } = props;
  const tooltip = 'Learn more in the Grafana docs';

  return (
    <LinkButton
      aria-label={tooltip}
      icon="external-link-alt"
      fill="text"
      href={`https://grafana.com/docs/grafana/next/datasources/${hrefSuffix}`}
      variant="secondary"
      size="md"
      target="_blank"
      tooltip={tooltip}
      tooltipPlacement="top"
    />
  );
}
