import React from 'react';

import { PanelModel, renderMarkdown, ScopedVars, LinkModelSupplier, PanelData } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Button, Dropdown, IconButton, Menu } from '@grafana/ui';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  panelId: number;
  data: PanelData;
  panelDescription?: string;
  links?: LinkModelSupplier<PanelModel>;
  replaceVariables: (value: string, extraVars: ScopedVars | undefined, format?: string | Function) => string;
  scopedVars?: ScopedVars;
  alertState?: string;
  itemHeight?: number;
  itemWidth?: number;
}

export function PanelHeaderTitleItems(props: Props) {
  const { panelDescription, alertState, scopedVars, links, replaceVariables, data, panelId } = props;

  // description
  const rawDescription = panelDescription || '';
  const descriptionMarkdown = getTemplateSrv().replace(rawDescription, scopedVars);
  const description = renderMarkdown(descriptionMarkdown);

  const getDescriptionContent = (): JSX.Element => {
    return (
      <div className="panel-info-content markdown-html">
        <div dangerouslySetInnerHTML={{ __html: description }} />
      </div>
    );
  };

  const descriptionItem = <IconButton name="info-circle" tooltip={getDescriptionContent} />;

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

  const linksItem = (
    <Dropdown overlay={getLinksContent}>
      <Button icon="external-link-alt" aria-label="panel links" variant="secondary" />
    </Dropdown>
  );

  // panel health
  const alertStateItem = (
    <IconButton
      name={alertState === 'alerting' ? 'heart-break' : 'heart'}
      tooltip={`alerting is ${alertState}`}
      className="icon-gf panel-alert-icon"
      style={{ marginRight: '4px' }}
      size="sm"
    />
  );

  // panel time range
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
