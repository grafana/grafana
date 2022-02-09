import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PageToolbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

type Props = {
  children: React.ReactNode | React.ReactNode[];
  title: string;
  wrapInContent?: boolean;
};

export function RuleViewerLayout(props: Props): JSX.Element | null {
  const { wrapInContent = true, children, title } = props;
  const styles = useStyles2(getPageStyles);

  return (
    <Page>
      <PageToolbar title={title} pageIcon="bell" onGoBack={() => locationService.push('/alerting/list')} />
      <div className={styles.content}>{wrapInContent ? <RuleViewerLayoutContent {...props} /> : children}</div>
    </Page>
  );
}

type ContentProps = {
  children: React.ReactNode | React.ReactNode[];
  padding?: number;
};

export function RuleViewerLayoutContent({ children, padding = 2 }: ContentProps): JSX.Element | null {
  const styles = useStyles2(getContentStyles(padding));
  return <div className={styles.wrapper}>{children}</div>;
}

const getPageStyles = (theme: GrafanaTheme2) => {
  return {
    content: css`
      margin: ${theme.spacing(0, 2, 2)};
      max-width: ${theme.breakpoints.values.xxl}px;
    `,
  };
};

const getContentStyles = (padding: number) => (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(padding)};
    `,
  };
};
