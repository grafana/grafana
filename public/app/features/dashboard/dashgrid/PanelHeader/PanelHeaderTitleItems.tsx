import { css, cx } from '@emotion/css';
import React from 'react';

import {
  PanelModel,
  renderMarkdown,
  ScopedVars,
  LinkModelSupplier,
  PanelData,
  InterpolateFunction,
  GrafanaTheme2,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Dropdown, Icon, Menu, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  innerHeight: number;
  innerWidth: number;
  panelDescription?: string;
  alertState?: string;
  scopedVars?: ScopedVars;
  replaceVariables: InterpolateFunction;
  links?: LinkModelSupplier<PanelModel>;
  data: PanelData;
  panelId: number;
}

export function PanelHeaderTitleItems(props: Props) {
  const { panelDescription, alertState, scopedVars, links, replaceVariables, data, panelId } = props;
  const styles = useStyles2(getStyles);
  // description
  const rawDescription = panelDescription || '';
  const descriptionMarkdown = getTemplateSrv().replace(rawDescription, scopedVars);
  const description = renderMarkdown(descriptionMarkdown);

  // panel links
  const panelLinks = links && links.getLinks(replaceVariables);

  const getDescriptionContent = (): JSX.Element => {
    return (
      <div className="panel-info-content markdown-html">
        <div dangerouslySetInnerHTML={{ __html: description }} />
      </div>
    );
  };

  const getLinksContent = (): JSX.Element => {
    return (
      <Menu>
        {panelLinks?.map((link, idx) => {
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} />;
        })}
      </Menu>
    );
  };

  const descriptionItem = (
    <Tooltip interactive content={getDescriptionContent}>
      <ToolbarButton icon="info-circle" className={styles.description} />
    </Tooltip>
  );

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
      {description && descriptionItem}
      {panelLinks && panelLinks.length > 0 && linksItem}
      {data.request && data.request.timeInfo && timeshift}
      {alertState && alertStateItem}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    border: 'none',

    code: {
      whiteSpace: 'normal',
      wordWrap: 'break-word',
    },

    'pre > code': {
      display: 'block',
    },
  }),

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
