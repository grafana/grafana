import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, ScopedVars } from '@grafana/data';
import { sanitize, sanitizeUrl } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { DashboardLink } from '@grafana/schema';
import { Dropdown, Icon, LinkButton, Button, Menu, ScrollContainer, useStyles2 } from '@grafana/ui';
import { ButtonLinkProps } from '@grafana/ui/internal';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult } from 'app/features/search/service/types';

import { getLinkSrv } from '../../../panel/panellinks/link_srv';

interface Props {
  link: DashboardLink;
  linkInfo: { title: string };
  dashboardUID: string;
  scopedVars?: ScopedVars;
}

interface DashboardLinksMenuProps {
  link: DashboardLink;
  dashboardUID: string;
}

function DashboardLinksMenu({ dashboardUID, link }: DashboardLinksMenuProps) {
  const styles = useStyles2(getStyles);
  const resolvedLinks = useResolvedLinks({ dashboardUID, link });

  if (!resolvedLinks || resolvedLinks.length === 0) {
    return (
      <Menu>
        <Menu.Item
          disabled
          label={t('dashboard.dashboard-links-menu.label-no-dashboards-found', 'No dashboards found')}
        />
      </Menu>
    );
  }

  return (
    <Menu>
      <div className={styles.dropdown}>
        <ScrollContainer maxHeight="inherit">
          {resolvedLinks.map((resolvedLink, index) => {
            return (
              <Menu.Item
                url={resolvedLink.url}
                target={link.targetBlank ? '_blank' : undefined}
                key={`dashlinks-dropdown-item-${resolvedLink.uid}-${index}`}
                label={resolvedLink.title}
                testId={selectors.components.DashboardLinks.link}
                aria-label={t(
                  'dashboard.dashboard-links-menu.aria-label-dashboard-name',
                  '{{dashboardName}} dashboard',
                  { dashboardName: resolvedLink.title }
                )}
              />
            );
          })}
        </ScrollContainer>
      </div>
    </Menu>
  );
}

export const DashboardLinksDashboard = ({ link, linkInfo, dashboardUID }: Props) => {
  const { title } = linkInfo;
  const resolvedLinks = useResolvedLinks({ link, dashboardUID });
  const styles = useStyles2(getStyles);

  if (link.asDropdown) {
    return (
      <Dropdown overlay={<DashboardLinksMenu link={link} dashboardUID={dashboardUID} />}>
        <DashboardLinkButton
          data-placement="bottom"
          data-toggle="dropdown"
          aria-controls="dropdown-list"
          aria-haspopup="menu"
          fill="outline"
          variant="secondary"
          data-testid={selectors.components.DashboardLinks.dropDown}
        >
          <Icon aria-hidden name="bars" className={styles.iconMargin} />
          <span>{title}</span>
        </DashboardLinkButton>
      </Dropdown>
    );
  }

  return (
    <>
      {resolvedLinks.length > 0 &&
        resolvedLinks.map((resolvedLink, index) => {
          return (
            <DashboardLinkButton
              key={`dashlinks-list-item-${resolvedLink.uid}-${index}`}
              icon="apps"
              variant="secondary"
              fill="outline"
              href={resolvedLink.url}
              target={link.targetBlank ? '_blank' : undefined}
              rel="noreferrer"
              data-testid={selectors.components.DashboardLinks.link}
            >
              {resolvedLink.title}
            </DashboardLinkButton>
          );
        })}
    </>
  );
};

const useResolvedLinks = ({ link, dashboardUID }: Pick<Props, 'link' | 'dashboardUID'>): ResolvedLinkDTO[] => {
  const { tags } = link;
  const result = useAsync(() => searchForTags(tags), [tags]);
  if (!result.value) {
    return [];
  }
  return resolveLinks(dashboardUID, link, result.value.view);
};

interface ResolvedLinkDTO {
  uid: string;
  url: string;
  title: string;
}

export async function searchForTags(tags: string[]) {
  return getGrafanaSearcher().search({ limit: 100, tags, kind: ['dashboard'] });
}

export function resolveLinks(
  dashboardUID: string,
  link: DashboardLink,
  searchHits: DashboardQueryResult[],
  dependencies: { getLinkSrv: typeof getLinkSrv; sanitize: typeof sanitize; sanitizeUrl: typeof sanitizeUrl } = {
    getLinkSrv,
    sanitize,
    sanitizeUrl,
  }
): ResolvedLinkDTO[] {
  const hits: ResolvedLinkDTO[] = [];
  for (const searchHit of searchHits) {
    if (searchHit.uid === dashboardUID) {
      continue;
    }
    const uid = searchHit.uid;
    const title = dependencies.sanitize(searchHit.name);
    const resolvedLink = dependencies.getLinkSrv().getLinkUrl({ ...link, url: searchHit.url });
    const url = dependencies.sanitizeUrl(resolvedLink);
    hits.push({ uid, title, url });
  }
  return hits;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    iconMargin: css({
      marginRight: theme.spacing(0.5),
    }),
    dropdown: css({
      maxWidth: 'max(30vw, 300px)',
      maxHeight: '70vh',
    }),
    button: css({
      color: theme.colors.text.primary,
    }),
    dashButton: css({
      fontSize: theme.typography.bodySmall.fontSize,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    }),
  };
}

export const DashboardLinkButton = forwardRef<unknown, ButtonLinkProps>(({ className, ...otherProps }, ref) => {
  const styles = useStyles2(getStyles);
  const Component = otherProps.href ? LinkButton : Button;
  return (
    <Component
      {...otherProps}
      variant="secondary"
      fill="outline"
      className={cx(className, styles.dashButton)}
      ref={ref as any}
    />
  );
});

DashboardLinkButton.displayName = 'DashboardLinkButton';
