import * as React from 'react';

/**
 * @alpha
 */
export interface PullRequestBannerProps {
  prURL?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
  branchInfo?: {
    targetBranch?: string;
    configuredBranch?: string;
    repoBaseUrl?: string;
  };
  action?: string;
  originalUrl?: string;
}

type PullRequestBannerType = React.ComponentType<PullRequestBannerProps>;

let PullRequestBannerComponent: PullRequestBannerType | undefined;

/**
 * @internal
 */
export function setPullRequestBanner(component: PullRequestBannerType) {
  PullRequestBannerComponent = component;
}

/**
 * @alpha
 */
export function PullRequestBanner(props: PullRequestBannerProps) {
  if (PullRequestBannerComponent) {
    return <PullRequestBannerComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime PullRequestBanner is not set</div>;
  }

  return null;
}
