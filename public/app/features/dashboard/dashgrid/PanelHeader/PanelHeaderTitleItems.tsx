import { css } from '@emotion/css';
import React from 'react';

import { PanelModel, LinkModelSupplier, PanelData, InterpolateFunction, GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  innerHeight: number;
  innerWidth: number;
  alertState?: string;
  replaceVariables: InterpolateFunction;
  links?: LinkModelSupplier<PanelModel>;
  data: PanelData;
  panelId: number;
}

export function PanelHeaderTitleItems(props: Props) {
  const { alertState, links, replaceVariables, data, panelId } = props;
  const styles = useStyles2(getStyles);

  // panel links
  const panelLinks = links && links.getLinks(replaceVariables);

  const getLinksContent = (): JSX.Element => {
    return (
      <Menu>
        {panelLinks?.map((link, idx) => {
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} />;
        })}
      </Menu>
    );
  };

  const alertStateItem = (
    <ToolbarButton
      icon={<Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" />}
      tooltip={`alerting is ${alertState}`}
      className={styles.item}
    />
  );

  const linksItem = (
    <Dropdown overlay={getLinksContent}>
      <ToolbarButton icon="external-link-alt" aria-label="panel links" className={styles.item} />
    </Dropdown>
  );

  const timeshift = (
    <>
      <ToolbarButton aria-label="timeshift" className={styles.timeshift} icon="clock-nine">
        {data.request?.timeInfo}
      </ToolbarButton>
    </>
  );

  return (
    <>
      {data.series && <PanelHeaderNotices frames={data.series} panelId={panelId} />}
      {panelLinks && panelLinks.length > 0 && linksItem}
      {data.request && data.request.timeInfo && timeshift}
      {alertState && alertStateItem}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    border: 'none',
  }),

  timeshift: css({
    border: 'none',
    color: theme.colors.text.link,

    '&:hover': {
      color: theme.colors.emphasize(theme.colors.text.link, 0.03),
    },
  }),
});
