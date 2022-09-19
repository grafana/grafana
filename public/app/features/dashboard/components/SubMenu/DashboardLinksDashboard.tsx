import { css, cx } from '@emotion/css';
import React, { useRef, useState, useLayoutEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItem } from 'app/features/search/types';

import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { DashboardLink } from '../../state/DashboardModel';

interface Props {
  link: DashboardLink;
  linkInfo: { title: string; href: string };
  dashboardUID: string;
}

export const DashboardLinksDashboard = (props: Props) => {
  const { link, linkInfo } = props;
  const listRef = useRef<HTMLUListElement>(null);
  const [dropdownCssClass, setDropdownCssClass] = useState('invisible');
  const [opened, setOpened] = useState(0);
  const resolvedLinks = useResolvedLinks(props, opened);
  const styles = useStyles2(getStyles);

  useLayoutEffect(() => {
    setDropdownCssClass(getDropdownLocationCssClass(listRef.current));
  }, [resolvedLinks]);

  if (link.asDropdown) {
    return (
      <LinkElement link={link} key="dashlinks-dropdown" data-testid={selectors.components.DashboardLinks.dropDown}>
        <>
          <ToolbarButton
            onClick={() => setOpened(Date.now())}
            className={cx('gf-form-label gf-form-label--dashlink', styles.button)}
            data-placement="bottom"
            data-toggle="dropdown"
            aria-expanded={!!opened}
            aria-controls="dropdown-list"
            aria-haspopup="menu"
          >
            <Icon aria-hidden name="bars" className={styles.iconMargin} />
            <span>{linkInfo.title}</span>
          </ToolbarButton>
          <ul
            id="dropdown-list"
            className={`dropdown-menu ${styles.dropdown} ${dropdownCssClass}`}
            role="menu"
            ref={listRef}
          >
            {resolvedLinks.length > 0 &&
              resolvedLinks.map((resolvedLink, index) => {
                return (
                  <li role="none" key={`dashlinks-dropdown-item-${resolvedLink.uid}-${index}`}>
                    <a
                      role="menuitem"
                      href={resolvedLink.url}
                      target={link.targetBlank ? '_blank' : undefined}
                      rel="noreferrer"
                      data-testid={selectors.components.DashboardLinks.link}
                      aria-label={`${resolvedLink.title} dashboard`}
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
              key={`dashlinks-list-item-${resolvedLink.uid}-${index}`}
              data-testid={selectors.components.DashboardLinks.container}
            >
              <a
                className="gf-form-label gf-form-label--dashlink"
                href={resolvedLink.url}
                target={link.targetBlank ? '_blank' : undefined}
                rel="noreferrer"
                data-testid={selectors.components.DashboardLinks.link}
                aria-label={`${resolvedLink.title} dashboard`}
              >
                <Icon aria-hidden name="apps" style={{ marginRight: '4px' }} />
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
  key: string;
  children: JSX.Element;
}

const LinkElement: React.FC<LinkElementProps> = (props) => {
  const { link, children, ...rest } = props;

  return (
    <div {...rest} className="gf-form">
      {link.tooltip && <Tooltip content={link.tooltip}>{children}</Tooltip>}
      {!link.tooltip && <>{children}</>}
    </div>
  );
};

const useResolvedLinks = ({ link, dashboardUID }: Props, opened: number): ResolvedLinkDTO[] => {
  const { tags } = link;
  const result = useAsync(() => searchForTags(tags), [tags, opened]);
  if (!result.value) {
    return [];
  }
  return resolveLinks(dashboardUID, link, result.value);
};

interface ResolvedLinkDTO {
  uid: string;
  url: string;
  title: string;
}

export async function searchForTags(
  tags: string[],
  dependencies: { getBackendSrv: typeof getBackendSrv } = { getBackendSrv }
): Promise<DashboardSearchItem[]> {
  const limit = 100;
  const searchHits: DashboardSearchItem[] = await dependencies.getBackendSrv().search({ tag: tags, limit });

  return searchHits;
}

export function resolveLinks(
  dashboardUID: string,
  link: DashboardLink,
  searchHits: DashboardSearchItem[],
  dependencies: { getLinkSrv: typeof getLinkSrv; sanitize: typeof sanitize; sanitizeUrl: typeof sanitizeUrl } = {
    getLinkSrv,
    sanitize,
    sanitizeUrl,
  }
): ResolvedLinkDTO[] {
  return searchHits
    .filter((searchHit) => searchHit.uid !== dashboardUID)
    .map((searchHit) => {
      const uid = searchHit.uid;
      const title = dependencies.sanitize(searchHit.title);
      const resolvedLink = dependencies.getLinkSrv().getLinkUrl({ ...link, url: searchHit.url });
      const url = dependencies.sanitizeUrl(resolvedLink);

      return { uid, title, url };
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

function getStyles(theme: GrafanaTheme2) {
  return {
    iconMargin: css({
      marginRight: theme.spacing(0.5),
    }),
    dropdown: css({
      maxWidth: 'max(30vw, 300px)',
      maxHeight: '70vh',
      overflowY: 'auto',
      a: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    button: css({
      color: theme.colors.text.primary,
    }),
  };
}
