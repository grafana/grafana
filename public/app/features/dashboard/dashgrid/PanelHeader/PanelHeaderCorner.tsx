import React, { Component } from 'react';

import { renderMarkdown } from '@grafana/data';
import { Tooltip, ScopedVars, DataLink } from '@grafana/ui';

import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import templateSrv from 'app/features/templating/template_srv';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

enum InfoMode {
  Error = 'Error',
  Info = 'Info',
  Links = 'Links',
}

interface Props {
  panel: PanelModel;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  links?: DataLink[];
  error?: string;
}

export class PanelHeaderCorner extends Component<Props> {
  timeSrv: TimeSrv = getTimeSrv();

  getInfoMode = () => {
    const { panel, error } = this.props;
    if (error) {
      return InfoMode.Error;
    }
    if (!!panel.description) {
      return InfoMode.Info;
    }
    if (panel.links && panel.links.length) {
      return InfoMode.Links;
    }

    return undefined;
  };

  getInfoContent = (): JSX.Element => {
    const { panel } = this.props;
    const markdown = panel.description;
    const linkSrv = new LinkSrv(templateSrv, this.timeSrv);
    const interpolatedMarkdown = templateSrv.replace(markdown, panel.scopedVars);
    const markedInterpolatedMarkdown = renderMarkdown(interpolatedMarkdown);

    return (
      <div className="panel-info-content markdown-html">
        <div dangerouslySetInnerHTML={{ __html: markedInterpolatedMarkdown }} />

        {panel.links && panel.links.length > 0 && (
          <ul className="panel-info-corner-links">
            {panel.links.map((link, idx) => {
              const info = linkSrv.getDataLinkUIModel(link, panel.scopedVars);
              return (
                <li key={idx}>
                  <a className="panel-info-corner-links__item" href={info.href} target={info.target}>
                    {info.title}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  renderCornerType(infoMode: InfoMode, content: string | JSX.Element) {
    const theme = infoMode === InfoMode.Error ? 'error' : 'info';
    return (
      <Tooltip content={content} placement="top-start" theme={theme}>
        <div className={`panel-info-corner panel-info-corner--${infoMode.toLowerCase()}`}>
          <i className="fa" />
          <span className="panel-info-corner-inner" />
        </div>
      </Tooltip>
    );
  }

  render() {
    const infoMode: InfoMode | undefined = this.getInfoMode();

    if (!infoMode) {
      return null;
    }

    if (infoMode === InfoMode.Error) {
      return this.renderCornerType(infoMode, this.props.error);
    }

    if (infoMode === InfoMode.Info || infoMode === InfoMode.Links) {
      return this.renderCornerType(infoMode, this.getInfoContent());
    }

    return null;
  }
}

export default PanelHeaderCorner;
