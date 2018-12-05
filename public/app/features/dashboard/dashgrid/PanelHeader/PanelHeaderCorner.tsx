import React, { PureComponent } from 'react';
import { PanelModel } from 'app/features/dashboard/panel_model';
import Tooltip from 'app/core/components/Tooltip/Tooltip';
import templateSrv from 'app/features/templating/template_srv';
import { LinkSrv } from 'app/features/dashboard/panellinks/link_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/time_srv';
import Remarkable from 'remarkable';

enum InfoModes {
  Error = 'Error',
  Info = 'Info',
  Links = 'Links',
}

interface Props {
  panel: PanelModel;
  title?: string;
  description?: string;
  scopedVars?: string;
  links?: [];
}

export class PanelHeaderCorner extends PureComponent<Props> {
  timeSrv: TimeSrv = getTimeSrv();

  getInfoMode = () => {
    const { panel } = this.props;
    if (!!panel.description) {
      return InfoModes.Info;
    }
    if (panel.links && panel.links.length) {
      return InfoModes.Links;
    }

    return undefined;
  };

  getInfoContent = (): JSX.Element => {
    const { panel } = this.props;
    const markdown = panel.description;
    const linkSrv = new LinkSrv(templateSrv, this.timeSrv);
    const interpolatedMarkdown = templateSrv.replace(markdown, panel.scopedVars);
    const remarkableInterpolatedMarkdown = new Remarkable().render(interpolatedMarkdown);

    const html = (
      <div className="markdown-html">
        <div dangerouslySetInnerHTML={{ __html: remarkableInterpolatedMarkdown }} />
        {panel.links &&
          panel.links.length > 0 && (
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

    return html;
  };

  render() {
    const infoMode: InfoModes | undefined = this.getInfoMode();

    if (!infoMode) {
      return null;
    }

    return (
      <>
        {infoMode === InfoModes.Info || infoMode === InfoModes.Links ? (
          <Tooltip
            content={this.getInfoContent}
            className="popper__manager--block"
            refClassName={`panel-info-corner panel-info-corner--${infoMode.toLowerCase()}`}
            placement="bottom-start"
          >
            <i className="fa" />
            <span className="panel-info-corner-inner" />
          </Tooltip>
        ) : null}
      </>
    );
  }
}

export default PanelHeaderCorner;
