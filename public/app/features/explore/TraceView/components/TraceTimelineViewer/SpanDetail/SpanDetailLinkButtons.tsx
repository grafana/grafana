import { css } from '@emotion/css';
import * as React from 'react';

import {
  GrafanaTheme2,
  IconName,
  PluginExtensionLink,
  PluginExtensionPoints,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, locationService, reportInteraction, usePluginLinks } from '@grafana/runtime';
import { ButtonGroup, ButtonSelect, DataLinkButton, useStyles2 } from '@grafana/ui';
import { RelatedProfilesTitle } from '@grafana-plugins/tempo/resultTransformer';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { SpanLinkFunc } from '../../types';
import { SpanLinkDef, SpanLinkType } from '../../types/links';
import { TraceSpan } from '../../types/trace';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    profilesDrilldownSelect: css({
      height: theme.spacing(3),
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    }),
    profilesForThisSpanButton: css({
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    }),
  };
};

type ExploreProfilesContext = {
  serviceName: string;
  profileTypeId: string;
  spanSelector: string;
  explorationType: string;
  timeRange: RawTimeRange;
  targets: Array<{ datasource: { type: string; uid: string | undefined; }; }>;
};

export type Props = {
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;  
  datasourceType: string;
  timeRange: TimeRange;
  createSpanLink?: SpanLinkFunc;
};

export const getSpanDetailLinkButtons = (props: Props) => {
  const {
    span,
    createSpanLink,
    traceToProfilesOptions,
    timeRange,
    datasourceType,
  } = props;
  const styles = useStyles2(getStyles);

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
        datasourceType,
        styles.profilesForThisSpanButton
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
  if (profileLinkButton) { // ensure we have a profile link
    const exploreProfilesPluginId = 'grafana-pyroscope-app';
    const spanSelector = span.tags.filter((tag) => tag.key === pyroscopeProfileIdTagKey);
    const context: ExploreProfilesContext = {
      serviceName: span.process.serviceName ?? '',
      profileTypeId: traceToProfilesOptions?.profileTypeId ?? '',
      spanSelector: spanSelector.length === 1 && spanSelector[0].value ? spanSelector[0].value : '',
      explorationType: 'flame-graph',
      timeRange: timeRange.raw,
      targets: [
        {
          datasource: {
            type: 'grafana-pyroscope-datasource',
            uid: traceToProfilesOptions?.datasourceUid,
          },
        },
      ],
    };

    // if in explore, use the plugin extension point to get the link
    // note: plugin extension point links are not currently supported in panel plugins
    if (window.location.pathname.startsWith('/explore')) {
      const extensionPointId = PluginExtensionPoints.TraceViewDetails;
      const { links } = usePluginLinks({ extensionPointId, context, limitPerPlugin: 1 });
      const link = links && links.length > 0 ? links.find((link) => link.pluginId === exploreProfilesPluginId) : null;

      // if we have a plugin link, add a button to open in Grafana Profiles Drilldown
      if (link) {
        profileLinkButtons = createProfileLinkButtons(profileLinkButton, styles, link);
      }
    } else { // fallback to building a url to open in Grafana Profiles Drilldown
      const drilldownProfilesAppExists = config.apps[exploreProfilesPluginId];

      if (drilldownProfilesAppExists) {
        const datasourceParam = context.targets.length > 0 ? `var-dataSource=${context.targets[0].datasource?.uid}` : '';
        const serviceNameParam = `&var-serviceName=${context.serviceName}`;
        const profileTypeParam = `&var-profileMetricId=${context.profileTypeId}`;
        const explorationTypeParam = `&explorationType=${context.explorationType}`;
        const timeRangeParam = `&from=${context.timeRange.from}&to=${context.timeRange.to}`;
        const spanSelectorParam = `&spanSelector=${context.spanSelector}`;

        const base = `/a/${exploreProfilesPluginId}/explore?`;
        const params = new URLSearchParams(
          `${datasourceParam}${serviceNameParam}${profileTypeParam}${timeRangeParam}${explorationTypeParam}${spanSelectorParam}`
        ).toString();
        const path = `${base}${params}`;
        
        profileLinkButtons = createProfileLinkButtons(profileLinkButton, styles, undefined, path);    
      }
    }
  }

  return { profileLinkButtons, logLinkButton, sessionLinkButton };
}

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

const createProfileLinkButtons = (profileLinkButton: JSX.Element, styles: { profilesDrilldownSelect: string; profilesForThisSpanButton?: string; }, link?: PluginExtensionLink, path?: string) => {
  const label = 'Open in Grafana Profiles Drilldown';
  return (
    <ButtonGroup>
      {profileLinkButton}
      <ButtonSelect
        className={styles.profilesDrilldownSelect}
        variant="primary"
        narrow
        options={[{ label, value: label }]}
        onChange={(e) => {
          if (e.value === label) {
            reportInteraction('grafana_traces_open_in_profiles_drilldown_clicked');

            if (link && link.onClick) {
              link.onClick();
            } else if (path) {
              window.open(path, '_blank', 'noopener,noreferrer');
            }
          }
        }}
      />
    </ButtonGroup>
  );
}
