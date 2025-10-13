import * as React from 'react';

import { CoreApp, IconName, PluginExtensionPoints, RawTimeRange, TimeRange } from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, locationService, reportInteraction, usePluginLinks } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { Button, DataLinkButton } from '@grafana/ui';
import { RelatedProfilesTitle } from '@grafana-plugins/tempo/resultTransformer';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { SpanLinkFunc } from '../../types';
import { SpanLinkDef, SpanLinkType } from '../../types/links';
import { TraceSpan } from '../../types/trace';

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
  timeRange: TimeRange;
  createSpanLink?: SpanLinkFunc;
  app: CoreApp;
};

export const getSpanDetailLinkButtons = (props: Props) => {
  const { span, createSpanLink, traceToProfilesOptions, timeRange, datasourceType, app } = props;

  let logLinkButton: JSX.Element | null = null;
  let profileLinkButton: JSX.Element | null = null;
  let sessionLinkButton: JSX.Element | null = null;
  if (createSpanLink) {
    const links = createSpanLink(span);
    const logsLink = links?.filter((link) => link.type === SpanLinkType.Logs);
    if (links && logsLink && logsLink.length > 0) {
      logLinkButton = createLinkButton(logsLink[0], SpanLinkType.Logs, 'Logs for this span', 'gf-logs', datasourceType);
    }
    const profilesLink = links?.filter(
      (link) => link.type === SpanLinkType.Profiles && link.title === RelatedProfilesTitle
    );
    if (links && profilesLink && profilesLink.length > 0) {
      profileLinkButton = createLinkButton(
        profilesLink[0],
        SpanLinkType.Profiles,
        'Profiles for this span',
        'link',
        datasourceType
      );
    }
    const sessionLink = links?.filter((link) => link.type === SpanLinkType.Session);
    if (links && sessionLink && sessionLink.length > 0) {
      sessionLinkButton = createLinkButton(
        sessionLink[0],
        SpanLinkType.Session,
        'Session for this span',
        'frontend-observability',
        datasourceType
      );
    }
  }

  let profileLinkButtons = profileLinkButton;
  if (profileLinkButton) {
    // ensure we have a profile link
    const profilesDrilldownPluginId = 'grafana-pyroscope-app';
    const context = getProfileLinkButtonsContext(span, traceToProfilesOptions, timeRange);

    // if in explore, use the plugin extension point to get the link
    // note: plugin extension point links are not currently supported in panel plugins
    if (app === CoreApp.Explore) {
      const extensionPointId = PluginExtensionPoints.TraceViewDetails;
      const { links } = usePluginLinks({ extensionPointId, context, limitPerPlugin: 1 });
      const link = links && links.length > 0 ? links.find((link) => link.pluginId === profilesDrilldownPluginId) : null;
      const label = 'Open in Profiles Drilldown';

      // if we have a plugin link, add a button to open in Grafana Profiles Drilldown
      if (link) {
        const profileDrilldownLinkButton = (
          <Button
            icon="link"
            variant="primary"
            size="sm"
            onClick={() => {
              if (link && link.onClick) {
                reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                  datasourceType,
                  grafana_version: config.buildInfo.version,
                  type: SpanLinkType.ProfilesDrilldown,
                  location: 'spanDetails',
                });

                link.onClick();
              }
            }}
          >
            {label}
          </Button>
        );

        profileLinkButtons = (
          <>
            {profileLinkButton}
            {profileDrilldownLinkButton}
          </>
        );
      }
    }
  }

  return { profileLinkButtons, logLinkButton, sessionLinkButton };
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

const createLinkButton = (
  link: SpanLinkDef,
  type: SpanLinkType,
  title: string,
  icon: IconName,
  datasourceType: string,
  className?: string
) => {
  return (
    <DataLinkButton
      link={{
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
            locationService.push(link.href);
          }
        },
      }}
      buttonProps={{ icon, className }}
    />
  );
};
