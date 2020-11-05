import React, { PureComponent } from 'react';

import { config } from '@grafana/runtime';
import { Icon, LinkButton } from '@grafana/ui';

import oops from 'img/oops.svg';

export default class ErrorPage extends PureComponent {
  render() {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-head">
            <Icon name="exclamation-triangle" className="error-icon" />
            <div className="error-title">
              <div className="error-code">404</div>
              <div className="error-text">ERROR</div>
            </div>
            <img src={oops} alt="oops" className="error-oops" />
          </div>
          <div className="error-main-text">Sorry, Page not found!</div>
          <div className="error-sub-text">The link you followed is probably broken or the page has been removed.</div>
          <LinkButton variant="secondary" href={config.appSubUrl} className="error-home-button">
            Return to Home page
          </LinkButton>
        </div>
      </div>
    );
  }
}
