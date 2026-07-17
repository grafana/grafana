import { css } from '@emotion/css';
import * as React from 'react';
import { useMemo } from 'react';

import {
  CoreApp,
  type GrafanaTheme2,
  type IconName,
  type LinkModel,
  PluginExtensionPoints,
  type RawTimeRange,
  type TimeRange,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, locationService, reportInteraction, usePluginLinks } from '@grafana/runtime';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataSourceRef } from '@grafana/schema';
import { Button, DataLinkButton, Dropdown, Menu, useStyles2 } from '@grafana/ui';
export const RelatedProfilesTitle = 'Related profiles';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { type SpanLinkDef, type SpanLinkFunc, type SpanLinkModel, SpanLinkType } from '../../types/links';
import { type TraceSpan } from '../../types/trace';

import { getLogsButtonCTA, LogsLinkButton } from './LogsLink';
import { ShareSpanButton } from './ShareSpanButton';

export type ProfilesButtonContext = {
  serviceName: string;
  profileTypeId: string;
  spanSelector: string;
  explorationType: string;
  timeRange: RawTimeRange;
  datasource: DataSourceRef;
};

export type Props = {
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;
  datasourceType: string;
  datasourceUid: string;
  timeRange: TimeRange;
  createSpanLink?: SpanLinkFunc;
  app: CoreApp;
  focusSpanLink: LinkModel;
};

/**
 * Order in which known link types are shown in the span details
 * This was added in https://github.com/grafana/grafana/pull/101881 to preserve the order of links
 * customers might have been used to. This will be revisted in https://github.com/grafana/grafana/issues/101925
 */
const LINKS_ORDER = [
  SpanLinkType.Metrics,
  SpanLinkType.Logs,
  SpanLinkType.Profiles,
  SpanLinkType.ProfilesDrilldown,
  SpanLinkType.Session,
];

/**
 * Maximum number of links to show before moving them to a dropdown
 */
const MAX_LINKS = 3;

const ABSOLUTE_LINK_PATTERN = /^https?:\/\//i;

export const SpanDetailLinkButtons = ({
  span,
  createSpanLink,
  traceToProfilesOptions,
  timeRange,
  datasourceType,
  datasourceUid,
  app,
  focusSpanLink,
}: Props) => {
  // Hooks must run unconditionally on every render, so fetch the plugin links up front.
  // The context only depends on props, and the fetched links are only consumed below when
  // a profiles link exists and we're in Explore.
  const context = getProfileLinkButtonsContext(span, traceToProfilesOptions, timeRange);
  const { links: pluginLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TraceViewDetails,
    context,
    limitPerPlugin: 1,
  });

  const { settings, isLoading } = useDataSourceInstanceSettings(datasourceUid);

  const links = useMemo(() => {
    let linkToProfiles: SpanLinkDef | undefined;

    if (isLoading) {
      return [];
    }

    const links = (createSpanLink?.(span) || [])
      // Linked spans are shown in a separate section
      .filter((link) => link.type !== SpanLinkType.Traces)
      .map((link) => {
        if (link.type === SpanLinkType.Logs) {
          return createLinkModel(
            link,
            SpanLinkType.Logs,
            getLogsButtonCTA(settings),
            'gf-logs',
            datasourceType,
            datasourceUid
          );
        }
        if (link.type === SpanLinkType.Profiles && link.title === RelatedProfilesTitle) {
          linkToProfiles = link;
          return createLinkModel(
            link,
            SpanLinkType.Profiles,
            t('explore.span-detail-link-buttons.profiles-for-this-span', 'Profiles for this span'),
            'link',
            datasourceType
          );
        }
        if (link.type === SpanLinkType.Session) {
          return createLinkModel(
            link,
            SpanLinkType.Session,
            t('explore.span-detail-link-buttons.session-for-this-span', 'Session for this span'),
            'frontend-observability',
            datasourceType
          );
        }
        return createLinkModel(link, SpanLinkType.Unknown, link.title || '', 'link', datasourceType);
      });

    // if in explore, use the plugin extension point to get the link
    // note: plugin extension point links are not currently supported in panel plugins
    // TODO: create SpanLinkDef in createSpanLink (https://github.com/grafana/grafana/issues/101925)
    if (linkToProfiles && app === CoreApp.Explore) {
      // ensure we have a profile link
      const profilesDrilldownPluginId = 'grafana-pyroscope-app';
      const link =
        pluginLinks && pluginLinks.length > 0
          ? pluginLinks.find((link) => link.pluginId === profilesDrilldownPluginId)
          : null;
      const label = t('explore.span-detail-link-buttons.open-in-profiles-drilldown', 'Open in Profiles Drilldown');
      const appLink: SpanLinkDef = {
        ...linkToProfiles,
        href: '',
        onClick: () => {
          link?.onClick?.();
        },
      };
      links.push(createLinkModel(appLink, SpanLinkType.ProfilesDrilldown, label, 'link', datasourceType));
    }

    links.sort((a, b) => {
      const aIndex = LINKS_ORDER.indexOf(a.type);
      const bIndex = LINKS_ORDER.indexOf(b.type);
      const aValue = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bValue = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return aValue - bValue;
    });

    return links;
  }, [app, createSpanLink, datasourceType, datasourceUid, isLoading, pluginLinks, settings, span]);

  return (
    <span className={styles.linksContainer}>
      {links.length > MAX_LINKS ? (
        <DropDownMenu links={links}></DropDownMenu>
      ) : (
        links.map((spanLinkModel, index) =>
          spanLinkModel.type === SpanLinkType.Logs ? (
            <LogsLinkButton spanLinkModel={spanLinkModel} key={index} />
          ) : (
            <SingleLinkButton spanLinkModel={spanLinkModel} key={index} />
          )
        )
      )}
      <ShareSpanButton focusSpanLink={focusSpanLink} />
    </span>
  );
};

const styles = {
  linksContainer: css({
    display: 'flex',
    width: '100%',
    flexDisplay: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '5px',
  }),
};

function getResponsibleButtonStyles(theme: GrafanaTheme2) {
  return css({
    [theme.breakpoints.down('sm')]: {
      span: { display: 'none' },
    },
  });
}

const SingleLinkButton: React.FC<{ spanLinkModel: SpanLinkModel }> = ({ spanLinkModel }) => {
  const styles = useStyles2(getResponsibleButtonStyles);
  const { linkModel, icon, className } = spanLinkModel;
  return (
    <span className={styles}>
      <DataLinkButton link={linkModel} buttonProps={{ icon, className }}></DataLinkButton>
    </span>
  );
};

const DropDownMenu = ({ links }: { links: SpanLinkModel[] }) => {
  const [_, setIsOpen] = React.useState(false);
  const styles = useStyles2(getResponsibleButtonStyles);

  const menu = (
    <Menu>
      {links.map(({ linkModel }, index) => (
        <Menu.Item
          key={index}
          label={linkModel.title}
          onClick={(event: React.MouseEvent) => linkModel.onClick?.(event)}
        />
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={setIsOpen}>
      <Button
        variant="primary"
        icon="link"
        size="sm"
        className={styles}
        aria-label={t('explore.drop-down-menu.aria-label-links', 'Links')}
      >
        <Trans i18nKey="explore.drop-down-menu.links">Links</Trans>
      </Button>
    </Dropdown>
  );
};

export const getProfileLinkButtonsContext = (
  span: TraceSpan,
  traceToProfilesOptions: TraceToProfilesOptions | undefined,
  timeRange: TimeRange
) => {
  const spanSelector = span.tags.filter((tag) => tag.key === pyroscopeProfileIdTagKey);
  const context: ProfilesButtonContext = {
    serviceName: span.process.serviceName ?? '',
    profileTypeId: traceToProfilesOptions?.profileTypeId ?? '',
    spanSelector: spanSelector.length === 1 && spanSelector[0].value ? spanSelector[0].value : '',
    explorationType: 'flame-graph',
    timeRange: {
      from: timeRange.from.toISOString(),
      to: timeRange.to.toISOString(),
    },
    datasource: { uid: traceToProfilesOptions?.datasourceUid },
  };
  return context;
};

const createLinkModel = (
  link: SpanLinkDef,
  type: SpanLinkType,
  title: string,
  icon: IconName,
  datasourceType: string,
  traceDatasourceUid?: string
): SpanLinkModel => {
  return {
    icon,
    type,
    linkModel: {
      ...link.linkModel,
      ...link,
      title: title,
      target: '_blank',
      origin: link.field,
      onClick: (event: React.MouseEvent) => {
        // DataLinkButton assumes if you provide an onClick event you would want to prevent default behavior like navigation
        // In this case, if an onClick is not defined, restore navigation to the provided href while keeping the tracking
        // this interaction will not be tracked with link right clicks
        reportInteraction('grafana_traces_trace_view_span_link_clicked', {
          datasourceType,
          grafana_version: config.buildInfo.version,
          type,
          location: 'spanDetails',
        });

        if (link.onClick) {
          link.onClick?.(event);
        } else {
          // TODO: Replace with https://github.com/grafana/grafana/issues/103593
          // We need to handle absolute and relative URLs correctly because when
          // there are multiple links we group them into a dropdown and not use
          // the grafana/ui DataLinkButton component which handles relative and
          // absolute URLs nicely. A nice solution would be to have a separate
          // component that handles this for us and not pass the onClick in the
          // SpanLinkModel when link.href is defined (removing the need of having
          // if (link.onClick) in here.

          // if it's an absolute URL - open it in a new window
          if (!ABSOLUTE_LINK_PATTERN.test(link.href)) {
            // handle relative URLs by changing current URL:
            locationService.push(link.href);
          } else {
            window.open(link.href, '_blank', 'noopener,noreferrer');
          }
        }
      },
    },
    traceDatasourceUid,
  };
};
