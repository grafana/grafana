import React, { Component } from 'react';

import { renderMarkdown, LinkModelSupplier, ScopedVars } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, getTemplateSrv } from '@grafana/runtime';
import { Tooltip, PopoverContent } from '@grafana/ui';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { InspectTab } from 'app/features/inspector/types';

enum InfoMode {
  Error = 'Error',
  Info = 'Info',
  Links = 'Links',
}

export interface Props {
  panel: PanelModel;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  links?: LinkModelSupplier<PanelModel>;
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
    const markdown = panel.description || '';
    const interpolatedMarkdown = getTemplateSrv().replace(markdown, panel.scopedVars);
    const markedInterpolatedMarkdown = renderMarkdown(interpolatedMarkdown);
    const links = this.props.links && this.props.links.getLinks(panel.replaceVariables);

    return (
      <div className="panel-info-content markdown-html">
        <div dangerouslySetInnerHTML={{ __html: markedInterpolatedMarkdown }} />

        {links && links.length > 0 && (
          <ul className="panel-info-corner-links">
            {links.map((link, idx) => {
              return (
                <li key={idx}>
                  <a className="panel-info-corner-links__item" href={link.href} target={link.target}>
                    {link.title}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  /**
   * Open the Panel Inspector when we click on an error
   */
  onClickError = () => {
    locationService.partial({
      inspect: this.props.panel.id,
      inspectTab: InspectTab.Error,
    });
  };

  renderCornerType(infoMode: InfoMode, content: PopoverContent, onClick?: () => void) {
    const theme = infoMode === InfoMode.Error ? 'error' : 'info';
    const className = `panel-info-corner panel-info-corner--${infoMode.toLowerCase()}`;
    const ariaLabel = selectors.components.Panels.Panel.headerCornerInfo(infoMode.toLowerCase());

    return (
      <Tooltip content={content} placement="top-start" theme={theme} interactive>
        <section className={className} onClick={onClick} aria-label={ariaLabel}>
          <i aria-hidden className="fa" />
          <span className="panel-info-corner-inner" />
        </section>
      </Tooltip>
    );
  }

  render() {
    const { error } = this.props;
    const infoMode: InfoMode | undefined = this.getInfoMode();

    if (!infoMode) {
      return null;
    }

    if (infoMode === InfoMode.Error && error) {
      return this.renderCornerType(infoMode, error, this.onClickError);
    }

    if (infoMode === InfoMode.Info || infoMode === InfoMode.Links) {
      return this.renderCornerType(infoMode, this.getInfoContent);
    }

    return null;
  }
}

export default PanelHeaderCorner;
