import React from 'react';

import { PanelModel, renderMarkdown, ScopedVars, LinkModelSupplier, PanelData } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Button, Dropdown, IconButton, Menu } from '@grafana/ui';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  innerHeight: number;
  innerWidth: number;
  panelDescription?: string;
  alertState?: string;
  scopedVars?: ScopedVars;
  replaceVariables: (value: string, extraVars: ScopedVars | undefined, format?: string | Function) => string;
  links?: LinkModelSupplier<PanelModel>;
  data: PanelData;
  panelId: number;
}

export function PanelHeaderTitleItems(props: Props) {
  // description
  const { panelDescription, alertState, scopedVars, links, replaceVariables, data, panelId } = props;
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

  const descriptionItem = <IconButton name="info-circle" tooltip={getDescriptionContent} />;

  const alertStateItem = (
    <IconButton
      name={alertState === 'alerting' ? 'heart-break' : 'heart'}
      tooltip={`alerting is ${alertState}`}
      className="icon-gf panel-alert-icon"
      style={{ marginRight: '4px' }}
      size="sm"
    />
  );

  const linksItem = (
    <Dropdown overlay={getLinksContent}>
      <Button icon="external-link-alt" aria-label="panel links" variant="secondary" />
    </Dropdown>
  );

  const timeshift = (
    <>
      <IconButton name="clock-nine" size="sm" />
      {data.request && data.request.timeInfo}
    </>
  );

  return (
    <>
      {data.series && <PanelHeaderNotices frames={data.series} panelId={panelId} />}
      {description && descriptionItem}
      {panelLinks && panelLinks.length > 0 && linksItem}
      {data.request && timeshift}
      {alertState && alertStateItem}
    </>
  );
}
