import React, { useContext } from 'react';
import { css } from 'emotion';
import { ThemeContext, LargeLinkButton, CallToActionCard } from '@grafana/ui';

export const NoDataSourceCallToAction = () => {
  const theme = useContext(ThemeContext);

  const message =
    'Explore requires at least one data source. Once you have added a data source, you can query it here.';
  const footer = (
    <>
      <i className="fa fa-rocket" />
      <> ProTip: You can also define data sources through configuration files. </>
      <a
        href="http://docs.grafana.org/administration/provisioning/#datasources?utm_source=explore"
        target="_blank"
        className="text-link"
      >
        Learn more
      </a>
    </>
  );

  const ctaElement = (
    <LargeLinkButton href="/datasources/new" icon="gicon gicon-datasources">
      Add data source
    </LargeLinkButton>
  );

  const cardClassName = css`
    max-width: ${theme.breakpoints.lg};
  `;

  return (
    <CallToActionCard
      callToActionElement={ctaElement}
      className={cardClassName}
      footer={footer}
      message={message}
      theme={theme}
    />
  );
};
