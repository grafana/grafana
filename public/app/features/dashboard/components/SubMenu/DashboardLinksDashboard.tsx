import React, { useRef, useState } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardLink } from '../../state/DashboardModel';
import { DashboardSearchHit } from 'app/features/search/types';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';

interface Props {
  link: DashboardLink;
  linkInfo: { title: string; href: string };
  dashboardId: any;
}

export const DashboardLinksDashboard: React.FC<Props> = props => {
  const { link, linkInfo } = props;
  const listRef = useRef<HTMLUListElement>(null);
  const [opened, setOpened] = useState(0);
  const resolvedLinks = useResolvedLinks(props, opened);

  if (link.asDropdown) {
    return (
      <LinkElement link={link} key="dashlinks-dropdown" aria-label={selectors.components.DashboardLinks.dropDown}>
        <>
          <a
            onClick={() => setOpened(Date.now())}
            className="gf-form-label gf-form-label--dashlink"
            data-placement="bottom"
            data-toggle="dropdown"
          >
            <Icon name="bars" style={{ marginRight: '4px' }} />
            <span>{linkInfo.title}</span>
          </a>
          <ul className={`dropdown-menu ${getDropdownLocationCssClass(listRef.current)}`} role="menu" ref={listRef}>
            {resolvedLinks.length > 0 &&
              resolvedLinks.map((resolvedLink, index) => {
                return (
                  <li key={`dashlinks-dropdown-item-${resolvedLink.id}-${index}`}>
                    <a
                      href={resolvedLink.url}
                      target={link.targetBlank ? '_blank' : '_self'}
                      aria-label={selectors.components.DashboardLinks.link}
                    >
                      {resolvedLink.title}
                    </a>
                  </li>
                );
              })}
          </ul>
        </>
      </LinkElement>
    );
  }

  return (
    <>
      {resolvedLinks.length > 0 &&
        resolvedLinks.map((resolvedLink, index) => {
          return (
            <LinkElement
              link={link}
              key={`dashlinks-list-item-${resolvedLink.id}-${index}`}
              aria-label={selectors.components.DashboardLinks.container}
            >
              <a
                className="gf-form-label gf-form-label--dashlink"
                href={resolvedLink.url}
                target={link.targetBlank ? '_blank' : '_self'}
                aria-label={selectors.components.DashboardLinks.link}
              >
                <Icon name="apps" style={{ marginRight: '4px' }} />
                <span>{resolvedLink.title}</span>
              </a>
            </LinkElement>
          );
        })}
    </>
  );
};

interface LinkElementProps {
  link: DashboardLink;
  'aria-label': string;
  key: string;
  children: JSX.Element;
}

const LinkElement: React.FC<LinkElementProps> = props => {
  const { link, children, ...rest } = props;

  return (
    <div {...rest} className="gf-form">
      {link.tooltip && <Tooltip content={link.tooltip}>{children}</Tooltip>}
      {!link.tooltip && <>{children}</>}
    </div>
  );
};

const useResolvedLinks = ({ link, dashboardId }: Props, opened: number): ResolvedLinkDTO[] => {
  const { tags } = link;
  const result = useAsync(() => searchForTags(tags), [tags, opened]);
  if (!result.value) {
    return [];
  }
  return resolveLinks(dashboardId, link, result.value);
};

interface ResolvedLinkDTO {
  id: any;
  url: string;
  title: string;
}

export async function searchForTags(
  tags: any[],
  dependencies: { getBackendSrv: typeof getBackendSrv } = { getBackendSrv }
): Promise<DashboardSearchHit[]> {
  const limit = 100;
  const searchHits: DashboardSearchHit[] = await dependencies.getBackendSrv().search({ tag: tags, limit });

  return searchHits;
}

export function resolveLinks(
  dashboardId: any,
  link: DashboardLink,
  searchHits: DashboardSearchHit[],
  dependencies: { getLinkSrv: typeof getLinkSrv; sanitize: typeof sanitize; sanitizeUrl: typeof sanitizeUrl } = {
    getLinkSrv,
    sanitize,
    sanitizeUrl,
  }
): ResolvedLinkDTO[] {
  return searchHits
    .filter(searchHit => searchHit.id !== dashboardId)
    .map(searchHit => {
      const id = searchHit.id;
      const title = dependencies.sanitize(searchHit.title);
      const resolvedLink = dependencies.getLinkSrv().getLinkUrl({ ...link, url: searchHit.url });
      const url = dependencies.sanitizeUrl(resolvedLink);

      return { id, title, url };
    });
}

function getDropdownLocationCssClass(element: HTMLElement | null) {
  if (!element) {
    return 'invisible';
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  if (pos.width === 0) {
    return 'invisible';
  }

  if (wrapperPos.left + pos.width + 10 > window.innerWidth) {
    return 'pull-left';
  } else {
    return 'pull-right';
  }
}
