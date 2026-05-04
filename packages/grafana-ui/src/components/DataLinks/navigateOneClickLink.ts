import { LinkModel } from '@grafana/data';

// Navigate to a oneClick data link by dispatching an anchor click so the
// document-level link interceptor handles same-origin URLs through the SPA
// router (locationService.push) instead of triggering a full page reload.
// Links with target="_blank" still navigate normally to a new tab. If the
// link supplies a custom onClick (e.g. internal links from data sources),
// it is invoked directly to mirror DataLinkButton's behavior.
export const navigateOneClickLink = (link: LinkModel, e: MouseEvent) => {
  if (link.onClick) {
    link.onClick(e);
    return;
  }

  const a = document.createElement('a');
  a.href = link.href;
  if (link.target === '_blank') {
    a.target = '_blank';
    a.rel = 'noreferrer';
  }
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
  }
};
