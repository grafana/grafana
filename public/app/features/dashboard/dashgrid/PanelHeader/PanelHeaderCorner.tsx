import React, { Component } from 'react';
import Remarkable from 'remarkable';
import { Tooltip, ScopedVars } from '@grafana/ui';

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
  links?: [];
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
    const remarkableInterpolatedMarkdown = new Remarkable().render(interpolatedMarkdown);

    return (
      <div className="markdown-html">
        <div dangerouslySetInnerHTML={{ __html: remarkableInterpolatedMarkdown }} />
        {panel.links && panel.links.length > 0 && (
          <ul className="text-left">
            {panel.links.map((link, idx) => {
              const info = linkSrv.getPanelLinkAnchorInfo(link, panel.scopedVars);
              return (
                <li key={idx}>
                  <a className="panel-menu-link" href={info.href} target={info.target}>
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
      <Tooltip content={content} placement="bottom-start" theme={theme}>
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

    if (infoMode === InfoMode.Info) {
      return this.renderCornerType(infoMode, this.getInfoContent());
    }

    return null;
  }
}

export default PanelHeaderCorner;
