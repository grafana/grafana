import React from 'react';

import { PanelModel, renderMarkdown, ScopedVars, LinkModelSupplier } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon, Tooltip } from '@grafana/ui';

export interface Props {
  panelDescription?: string;
  alertState?: string;
  scopedVars?: ScopedVars;
  replaceVariables: (value: string, extraVars: ScopedVars | undefined, format?: string | Function) => string;
  links?: LinkModelSupplier<PanelModel>;
}

export function PanelHeaderTitleItems(props: Props) {
  // description
  const { panelDescription, alertState, scopedVars, links, replaceVariables } = props;
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
      <ul className="panel-info-corner-links">
        {panelLinks?.map((link, idx: number) => {
          return (
            <li key={idx}>
              <a className="panel-info-corner-links__item" href={link.href} target={link.target}>
                {link.title}
              </a>
            </li>
          );
        })}
      </ul>
    );
  };

  const descriptionItem = description ? (
    <Tooltip content={getDescriptionContent} placement="top-start">
      <Icon name="info-circle" />
    </Tooltip>
  ) : null;

  const alertStateItem = alertState ? (
    <Icon
      name={alertState === 'alerting' ? 'heart-break' : 'heart'}
      className="icon-gf panel-alert-icon"
      style={{ marginRight: '4px' }}
      size="sm"
    />
  ) : null;

  const linksItem =
    panelLinks && panelLinks.length > 0 ? (
      <Tooltip content={getLinksContent} placement="top-start">
        <Icon name="external-link-alt" />
      </Tooltip>
    ) : null;

  return (
    <>
      {descriptionItem}
      {alertStateItem}
      {linksItem}
    </>
  );
}
